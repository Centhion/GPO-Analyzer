"""
Terminal WebSocket Router

Provides browser-based terminal access to the container shell.
Enables direct CLI usage of gpo_analyzer.py from the web interface.
"""

import os
import pty
import select
import asyncio
import fcntl
import struct
import termios
import signal
import logging
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/terminal", tags=["Terminal"])


class TerminalSession:
    """Manages a PTY session for a WebSocket connection."""
    
    def __init__(self):
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self.running: bool = False
    
    def start(self) -> tuple[bool, str]:
        """
        Spawn a shell in a PTY.
        Returns (success, error_message).
        """
        # Find available shell - /bin/sh is guaranteed on all Unix systems
        shell = "/bin/sh"
        shell_args = ["/bin/sh", "-i"]
        
        # Check if bash is available for better experience
        if os.path.exists("/bin/bash"):
            shell = "/bin/bash"
            shell_args = ["/bin/bash", "--norc", "--noprofile", "-i"]
        
        try:
            # Fork a PTY
            self.pid, self.master_fd = pty.fork()
            
            if self.pid == 0:
                # Child process - exec shell
                try:
                    os.chdir("/app")
                except Exception:
                    pass  # Stay in current dir if /app doesn't exist
                
                # Set up environment for nice colored prompt
                env = os.environ.copy()
                env["TERM"] = "xterm-256color"
                env["PS1"] = "\\[\\033[1;32m\\]gpo-analyzer\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]$ "
                env["PYTHONUNBUFFERED"] = "1"
                
                # Exec shell
                os.execvpe(shell, shell_args, env)
                # If exec fails, exit child
                os._exit(1)
            else:
                # Parent process
                self.running = True
                
                # Set non-blocking mode on master FD
                flags = fcntl.fcntl(self.master_fd, fcntl.F_GETFL)
                fcntl.fcntl(self.master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)
                
                logger.info(f"Terminal session started: pid={self.pid}, shell={shell}")
                return True, ""
                
        except Exception as e:
            logger.error(f"Failed to start terminal: {e}")
            self.cleanup()
            return False, str(e)
    
    def cleanup(self):
        """Clean up any partial state."""
        self.running = False
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None
        self.pid = None
    
    def resize(self, rows: int, cols: int):
        """Resize the PTY window."""
        if self.master_fd is not None:
            try:
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.master_fd, termios.TIOCSWINSZ, winsize)
            except Exception as e:
                logger.warning(f"Failed to resize terminal: {e}")
    
    def write(self, data: bytes):
        """Write data to the PTY."""
        if self.master_fd is not None and self.running:
            try:
                os.write(self.master_fd, data)
            except Exception as e:
                logger.warning(f"Failed to write to terminal: {e}")
    
    def read(self) -> Optional[bytes]:
        """Read available data from the PTY (non-blocking)."""
        if self.master_fd is None or not self.running:
            return None
        
        try:
            # Check if data is available
            r, _, _ = select.select([self.master_fd], [], [], 0)
            if r:
                return os.read(self.master_fd, 4096)
        except OSError:
            # PTY closed
            self.running = False
        except Exception as e:
            logger.warning(f"Failed to read from terminal: {e}")
        
        return None
    
    def stop(self):
        """Clean up the terminal session."""
        self.running = False
        
        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGTERM)
                # Wait with timeout to avoid blocking
                for _ in range(10):
                    pid, status = os.waitpid(self.pid, os.WNOHANG)
                    if pid != 0:
                        break
                    import time
                    time.sleep(0.1)
            except Exception:
                pass
            self.pid = None
        
        if self.master_fd is not None:
            try:
                os.close(self.master_fd)
            except Exception:
                pass
            self.master_fd = None
        
        logger.info("Terminal session stopped")


@router.websocket("/ws")
async def terminal_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for terminal access.
    
    Protocol:
    - Text messages: Input to send to shell
    - Binary messages: Resize commands (JSON: {"type": "resize", "rows": N, "cols": N})
    - Server sends: Terminal output as text
    """
    await websocket.accept()
    logger.info("Terminal WebSocket connected")
    
    session = TerminalSession()
    
    success, error = session.start()
    if not success:
        error_msg = f"\r\n\033[1;31mFailed to start terminal: {error}\033[0m\r\n"
        try:
            await websocket.send_text(error_msg)
        except Exception:
            pass
        await websocket.close(code=1011, reason="Failed to start terminal")
        return
    
    # Set initial size (default 80x24)
    session.resize(24, 80)
    
    # Send welcome message (brief - detailed reference is below terminal in UI)
    welcome = "\r\n\033[1;36m╔════════════════════════════════════════════════════════════╗\033[0m\r\n"
    welcome += "\033[1;36m║           GPO Analyzer Terminal v2.3.2                     ║\033[0m\r\n"
    welcome += "\033[1;36m╚════════════════════════════════════════════════════════════╝\033[0m\r\n\r\n"
    welcome += "  python gpo_analyzer.py --help     Show all options\r\n"
    welcome += "  ls data/html_reports/             List available HTML files\r\n\r\n"
    welcome += "\033[1;32m✓ Download:\033[0m Save to \033[1mdata/downloads/\033[0m → Get clickable download URL\r\n\r\n"
    welcome += "\033[0;90mTip: Click 'Show Quick Reference' below for examples & operation codes\033[0m\r\n\r\n"
    
    await websocket.send_text(welcome)
    
    try:
        # Create tasks for reading from PTY and WebSocket
        async def read_pty():
            """Read from PTY and send to WebSocket."""
            while session.running:
                data = session.read()
                if data:
                    try:
                        await websocket.send_text(data.decode("utf-8", errors="replace"))
                    except Exception:
                        break
                await asyncio.sleep(0.01)  # Small delay to prevent busy loop
        
        async def read_websocket():
            """Read from WebSocket and write to PTY."""
            while session.running:
                try:
                    message = await asyncio.wait_for(
                        websocket.receive(),
                        timeout=0.1
                    )
                    
                    if message["type"] == "websocket.receive":
                        if "text" in message:
                            # Regular input
                            session.write(message["text"].encode("utf-8"))
                        elif "bytes" in message:
                            # Could be resize command - try to parse
                            try:
                                import json
                                cmd = json.loads(message["bytes"].decode("utf-8"))
                                if cmd.get("type") == "resize":
                                    session.resize(cmd.get("rows", 24), cmd.get("cols", 80))
                            except Exception:
                                pass
                    elif message["type"] == "websocket.disconnect":
                        break
                        
                except asyncio.TimeoutError:
                    continue
                except WebSocketDisconnect:
                    break
                except Exception as e:
                    logger.warning(f"WebSocket read error: {e}")
                    break
        
        # Run both tasks concurrently
        pty_task = asyncio.create_task(read_pty())
        ws_task = asyncio.create_task(read_websocket())
        
        # Wait for either to complete (connection closed or error)
        done, pending = await asyncio.wait(
            [pty_task, ws_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
    
    except WebSocketDisconnect:
        logger.info("Terminal WebSocket disconnected by client")
    except Exception as e:
        logger.error(f"Terminal WebSocket error: {e}")
    finally:
        session.stop()
        logger.info("Terminal WebSocket closed")
