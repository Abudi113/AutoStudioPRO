
export type CameraAngle =
  | 'front'
  | 'rear'
  | 'left'
  | 'right'
  | 'front_left_34'
  | 'front_right_34'
  | 'rear_left_34'
  | 'rear_right_34'
  | 'interior'
  | 'detail'
  | 'door_open'
  | 'trunk_open'
  | 'hood_open';

export interface StudioTemplate {
  id: string;
  name: string;
  thumbnail: string;
  description: string;
  category: 'Indoor' | 'Outdoor' | 'Premium';
  isFavorite: boolean;
}

export interface ProcessingJob {
  id: string;
  originalImage: string;
  processedImage?: string;
  angle: CameraAngle;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface BrandingConfig {
  logoUrl: string | null;
  isEnabled: boolean;
}

export interface Order {
  id: string;
  title: string;
  vin: string;
  createdAt: string;
  status: 'active' | 'completed' | 'draft';
  jobs: ProcessingJob[];
  studioId: string;
  taskType: string;
  branding?: BrandingConfig;
}

export interface TaskType {
  id: string;
  label: string;
  icon: string;
  description: string;
}
