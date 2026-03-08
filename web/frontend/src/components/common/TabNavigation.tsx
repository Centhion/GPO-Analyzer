import type { TabConfig } from '../../types';

interface TabNavigationProps {
  tabs: TabConfig[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b border-warm-300 bg-warm-100">
      <nav className="flex overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`tab-button whitespace-nowrap ${activeTab === tab.id ? 'active' : ''}`}
            aria-current={activeTab === tab.id ? 'page' : undefined}
          >
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel || tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
