interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="spinner"></div>
      <p className="mt-4 text-gray-600">{message}</p>
    </div>
  );
}
