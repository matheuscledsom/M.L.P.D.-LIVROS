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

export function VectorIcon({ name, className = 'h-3.5 w-3.5', strokeWidth = 2, ...props }) {
  const Icon = ICON_MAP[name] || BookOpen;
  return <Icon className={className} strokeWidth={strokeWidth} {...props} />;
}
