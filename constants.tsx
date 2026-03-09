
import { CameraAngle, StudioTemplate, TaskType } from './types';

export const CAMERA_ANGLES: { id: CameraAngle; label: string; icon: string }[] = [
  { id: 'front', label: 'angleFront', icon: 'fa-arrow-up' },
  { id: 'front_left_34', label: 'angleFrontLeft', icon: 'fa-arrow-up-right' },
  { id: 'left', label: 'angleLeft', icon: 'fa-arrow-right' },
  { id: 'rear_left_34', label: 'angleRearLeft', icon: 'fa-arrow-down-right' },
  { id: 'rear', label: 'angleRear', icon: 'fa-arrow-down' },
  { id: 'rear_right_34', label: 'angleRearRight', icon: 'fa-arrow-down-left' },
  { id: 'right', label: 'angleRight', icon: 'fa-arrow-left' },
  { id: 'front_right_34', label: 'angleFrontRight', icon: 'fa-arrow-up-left' },
  { id: 'interior_1', label: 'angleInterior1', icon: 'fa-steering-wheel' },
  { id: 'interior_2', label: 'angleInterior2', icon: 'fa-gauge-high' },
  { id: 'interior_3', label: 'angleInterior3', icon: 'fa-sliders' },
  { id: 'interior_4', label: 'angleInterior4', icon: 'fa-car-side' },
  { id: 'interior_5', label: 'angleInterior5', icon: 'fa-box-open' },
  { id: 'interior_6', label: 'angleInterior6', icon: 'fa-chair' },
  { id: 'interior_7', label: 'angleInterior7', icon: 'fa-tachograph-digital' },
  { id: 'interior_8', label: 'angleInterior8', icon: 'fa-couch' },
];

export const STUDIO_PRESETS: StudioTemplate[] = [
  {
    id: 'studio-01',
    name: 'White Loft',
    thumbnail: '/studios/White Loft.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },

  {
    id: 'studio-03',
    name: 'Studio (2)',
    thumbnail: '/studios/Studio (2).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-04',
    name: 'Studio (3)',
    thumbnail: '/studios/Studio (3).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-05',
    name: 'Studio (4)',
    thumbnail: '/studios/Studio (4).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-06',
    name: 'Studio (5)',
    thumbnail: '/studios/Studio (5).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-07',
    name: 'Studio (6)',
    thumbnail: '/studios/Studio (6).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-08',
    name: 'Studio (7)',
    thumbnail: '/studios/Studio (7).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-09',
    name: 'Studio (8)',
    thumbnail: '/studios/Studio (8).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-10',
    name: 'Studio (9)',
    thumbnail: '/studios/Studio (9).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-11',
    name: 'Studio (10)',
    thumbnail: '/studios/Studio (10).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  },
  {
    id: 'studio-12',
    name: 'Studio (11)',
    thumbnail: '/studios/Studio (11).jpeg',
    description: 'studioProfessional',
    category: 'Indoor',
    isFavorite: false,
  }
];

export const TASKS: TaskType[] = [
  {
    id: 'bg-replacement',
    label: 'taskBgReplacement',
    icon: 'Sparkles',
    description: 'taskBgDesc'
  },
];

export const DEFAULT_STUDIO_BG = "https://images.unsplash.com/photo-1553260162-718342489878?auto=format&fit=crop&q=80&w=1200";
