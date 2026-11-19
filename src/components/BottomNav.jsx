import { BarChart2, Home, Library, PlusCircle, User } from 'lucide-react';
import { domainConfig } from '../config/domainConfig';

const ICONS = {
  Home,
  BarChart2,
  PlusCircle,
  Library,
  User,
};

export function BottomNav({ activeTab, onChangeTab }) {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-40"
    >
      <div className="mx-auto max-w-md md:max-w-2xl lg:max-w-4xl border-t border-line bg-app/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="grid h-16 grid-cols-5 items-center px-2">
          {domainConfig.navigation.map((item) => {
            const Icon = ICONS[item.icon] || Home;
            const isActive = activeTab === item.id;

            if (item.isCenterHighlight) {
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChangeTab(item.id)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className="group flex flex-col items-center justify-center gap-0.5 focus:outline-none"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
                      isActive
                        ? 'scale-105 bg-accent text-accent-ink shadow-lg'
                        : 'border border-accent/40 bg-accent/15 text-accent group-hover:bg-accent/25'
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <span
                    className={`text-[10px] font-medium tracking-tight transition-colors ${
                      isActive ? 'text-ink' : 'text-accent'
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className="flex flex-col items-center justify-center gap-1 py-1 transition-colors focus:outline-none"
              >
                <Icon
                  className={`h-5 w-5 transition-colors ${
                    isActive ? 'text-accent' : 'text-subtle hover:text-muted'
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.75}
                />
                <span
                  className={`text-[10px] font-medium tracking-tight transition-colors ${
                    isActive ? 'text-ink' : 'text-subtle'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
