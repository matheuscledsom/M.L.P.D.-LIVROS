import {
  BookOpen,
  Brain,
  Camera,
  Compass,
  Cpu,
  Eye,
  Feather,
  Flame,
  GraduationCap,
  Heart,
  HeartCrack,
  Hourglass,
  Layers,
  Moon,
  Mountain,
  Snowflake,
  Sparkles,
  Star,
} from 'lucide-react';

const ICON_MAP = {
  BookOpen,
  Brain,
  Camera,
  Compass,
  Cpu,
  Eye,
  Feather,
  Flame,
  GraduationCap,
  Heart,
  HeartCrack,
  Hourglass,
  Layers,
  Moon,
  Mountain,
  Snowflake,
  Sparkles,
  Star,
};

export function VectorIcon({ name, className = 'h-4 w-4', strokeWidth = 1.5, ...props }) {
  const Icon = ICON_MAP[name] || BookOpen;
  return <Icon className={className} strokeWidth={strokeWidth} {...props} />;
}
