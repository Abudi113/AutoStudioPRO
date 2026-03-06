
import { CameraAngle, StudioTemplate, TaskType } from './types';

export const CAMERA_ANGLES: {
  id: CameraAngle;
  label: string;
  icon: string;
  template: 'front' | 'rear' | 'side' | 'three-quarter' | 'interior';
  defaultZoom: number;
  hint: string;
}[] = [
    { id: 'front', label: 'Front', icon: 'fa-arrow-up', template: 'front', defaultZoom: 1, hint: 'positionHints.front' },
    { id: 'front_right_34', label: 'Front Right', icon: 'fa-arrow-up-right', template: 'three-quarter', defaultZoom: 1, hint: 'positionHints.threeQuarter' },
    { id: 'right', label: 'Side Right', icon: 'fa-arrow-right', template: 'side', defaultZoom: 1, hint: 'positionHints.side' },
    { id: 'rear_right_34', label: 'Rear Right', icon: 'fa-arrow-down-right', template: 'three-quarter', defaultZoom: 1, hint: 'positionHints.threeQuarter' },
    { id: 'rear', label: 'Rear', icon: 'fa-arrow-down', template: 'rear', defaultZoom: 1, hint: 'positionHints.rear' },
    { id: 'rear_left_34', label: 'Rear Left', icon: 'fa-arrow-down-left', template: 'three-quarter', defaultZoom: 1, hint: 'positionHints.threeQuarter' },
    { id: 'left', label: 'Side Left', icon: 'fa-arrow-left', template: 'side', defaultZoom: 1, hint: 'positionHints.side' },
    { id: 'front_left_34', label: 'Front Left', icon: 'fa-arrow-up-left', template: 'three-quarter', defaultZoom: 1, hint: 'positionHints.threeQuarter' },

    // Interior
    { id: 'interior_driver', label: 'Driver', icon: 'fa-circle-user', template: 'interior', defaultZoom: 1.5, hint: 'positionHints.interior' },
    { id: 'interior_passenger', label: 'Front Passenger', icon: 'fa-user', template: 'interior', defaultZoom: 1.5, hint: 'positionHints.interior' },
    { id: 'interior_rear', label: 'Rear Seat', icon: 'fa-couch', template: 'interior', defaultZoom: 1.5, hint: 'positionHints.interior' },
  ];

export const STUDIO_PRESETS: StudioTemplate[] = [
  {
    id: 'white-infinity',
    name: 'studioWhiteInfinity',
    thumbnail: '/studios/white-infinity-studio.png',
    description: 'studioWhiteInfinityDesc',
    category: 'Indoor',
    isFavorite: true,
  },
  {
    id: 'studio-1',
    name: 'studio1',
    thumbnail: '/studios/hf_20260128_234306_1ef50d5c-b3ba-4a27-a180-5892106e378a.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-2',
    name: 'studio2',
    thumbnail: '/studios/hf_20260129_000619_0e1ac526-afac-4dec-a296-65f8b7fadbf7 (1).png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-3',
    name: 'studio3',
    thumbnail: '/studios/hf_20260131_172446_27da6c94-9022-4ecd-a3d1-7137e812a0a2.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-4',
    name: 'studio4',
    thumbnail: '/studios/hf_20260131_172835_e9dbe07b-ec07-4b90-be9f-f1839a1112d3 (1).png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-5',
    name: 'studio5',
    thumbnail: '/studios/hf_20260131_174838_9296d3af-ed3d-4eef-8db8-d95235f76ada.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-6',
    name: 'studio6',
    thumbnail: '/studios/hf_20260131_174910_8237c869-bf7a-4ff6-9a06-f1e3e170b391.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-7',
    name: 'studio7',
    thumbnail: '/studios/hf_20260131_175332_bdd605f1-4360-47dc-9f5b-6b84ec6f8bff.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-8',
    name: 'studio8',
    thumbnail: '/studios/hf_20260131_175415_386a1ed2-6203-40f8-93b2-54f960fad58b.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-9',
    name: 'studio9',
    thumbnail: '/studios/hf_20260131_175533_ef1d84ff-b634-4958-aebf-78b3b4ef72ba.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-10',
    name: 'studio10',
    thumbnail: '/studios/hf_20260131_175725_46a96841-791a-4593-ab91-fbbe2adda571.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-11',
    name: 'studio11',
    thumbnail: '/studios/hf_20260131_181211_9f2b33f8-674f-4d69-b067-4ebc6eda5bc8 (1).png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-12',
    name: 'studio12',
    thumbnail: '/studios/hf_20260131_181256_6ffd4fe5-0038-4e22-9f4e-b4960917f8b0.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-13',
    name: 'studio13',
    thumbnail: '/studios/hf_20260131_181317_05fe04b5-0fa7-4e66-ae4c-3e94224c94f0.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-14',
    name: 'studio14',
    thumbnail: '/studios/hf_20260131_181539_6f8f0e41-a742-4fc2-b55b-ee336769c415.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-15',
    name: 'studio15',
    thumbnail: '/studios/hf_20260131_181551_b401a893-c115-44ce-87b9-7c2a7b18a4e7.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-16',
    name: 'studio16',
    thumbnail: '/studios/hf_20260131_181734_89b78e68-e821-46df-b016-614cfc620eac (1).png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-17',
    name: 'studio17',
    thumbnail: '/studios/hf_20260131_181747_8489648e-abeb-46ef-b1c0-0f3ad8db0d4e.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-18',
    name: 'studio18',
    thumbnail: '/studios/hf_20260131_182511_ae00d5cc-771d-43fd-a021-3ee1354626af (1).png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
  {
    id: 'studio-19',
    name: 'studio19',
    thumbnail: '/studios/hf_20260131_182707_42c8ea73-7282-4a82-9290-ad604b6aa987.png',
    description: 'studioProfessional',
    category: 'Premium',
    isFavorite: false,
  },
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
