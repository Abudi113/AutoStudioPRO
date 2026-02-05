
import { StudioTemplate, CameraAngle, TaskType } from './types';

export const CAMERA_ANGLES: { id: CameraAngle; label: string; icon: string }[] = [
  { id: 'front', label: 'Front View', icon: 'fa-arrow-up' },
  { id: 'rear', label: 'Rear View', icon: 'fa-arrow-down' },
  { id: 'left', label: 'Left Side', icon: 'fa-arrow-left' },
  { id: 'right', label: 'Right Side', icon: 'fa-arrow-right' },
  { id: 'front_left_34', label: 'Front-Left 3/4', icon: 'fa-arrow-up-left' },
  { id: 'front_right_34', label: 'Front-Right 3/4', icon: 'fa-arrow-up-right' },
  { id: 'rear_left_34', label: 'Rear-Left 3/4', icon: 'fa-arrow-down-left' },
  { id: 'rear_right_34', label: 'Rear-Right 3/4', icon: 'fa-arrow-down-right' },
  { id: 'interior', label: 'Interior Cabin', icon: 'fa-car-side' },
];

export const STUDIO_PRESETS: StudioTemplate[] = [
  {
    id: 'white-infinity',
    name: 'White Infinity Room',
    thumbnail: '/studios/white-infinity-studio.png',
    description: 'Clean, professional white studio with soft reflections.',
    category: 'Indoor',
    isFavorite: true,
  },
  {
    id: 'dark-industrial',
    name: 'Dark Industrial Loft',
    thumbnail: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80&w=400',
    description: 'Moody, high-contrast industrial setting for luxury vehicles.',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'concrete-hangar',
    name: 'Concrete Hangar',
    thumbnail: 'https://images.unsplash.com/photo-1542282088-fe8426682b8f?auto=format&fit=crop&q=80&w=400',
    description: 'Spacious concrete flooring with dramatic overhead lighting.',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'urban-modern',
    name: 'Urban Modern Rooftop',
    thumbnail: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80&w=400',
    description: 'Modern city skyline backdrop with natural day lighting.',
    category: 'Outdoor',
    isFavorite: false,
  },
];

export const TASKS: TaskType[] = [
  { id: 'bg-replacement', label: 'Background Replacement', icon: 'fa-image', description: 'Swap background with pro studio presets.' },
  { id: 'plate-blur', label: 'Plate Blur/Replace', icon: 'fa-id-card', description: 'Automatically detect and anonymize license plates.' },
  { id: 'interior', label: 'Interior Enhancement', icon: 'fa-car-side', description: 'Brighten and clear up cabin and cockpit shots.' },
];

export const DEFAULT_STUDIO_BG = "https://images.unsplash.com/photo-1553260162-718342489878?auto=format&fit=crop&q=80&w=1200";
