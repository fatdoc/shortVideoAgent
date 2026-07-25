export type ProjectStatus =
  | 'draft'
  | 'briefing'
  | 'branding'
  | 'scripting'
  | 'storyboarding'
  | 'production'
  | 'editing'
  | 'qa'
  | 'exported';

export type BusinessType = 'local_store' | 'product' | 'brand' | 'event';

export type AspectRatio = '9:16' | '1:1' | '16:9';

export type ClaimType = 'fact' | 'price' | 'service' | 'policy' | 'disclaimer';

export type ClaimStatus = 'approved' | 'pending' | 'expired' | 'rejected';

export type ScriptBlockType = 'hook' | 'body' | 'proof' | 'cta' | 'disclaimer';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type ShotStatus = 'planned' | 'ready' | 'shooting' | 'done' | 'missing';

export type AssetMatchStatus = 'matched' | 'reshoot' | 'missing' | 'ai_placeholder';

export type AssetType = 'video' | 'image' | 'audio' | 'text';

export type AssetSource = 'upload' | 'library' | 'ai' | 'stock';

export type QaCheckKey =
  | 'clarity'
  | 'subtitle'
  | 'bgm'
  | 'sensitive_words'
  | 'missing_shots'
  | 'export_ready';

export type QaCheckStatus = 'pass' | 'warn' | 'fail' | 'pending';

export interface Project {
  id: string;
  name: string;
  businessType: BusinessType;
  status: ProjectStatus;
  progress: number;
  owner: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBrief {
  projectId: string;
  businessType: BusinessType;
  merchantName: string;
  city: string;
  address: string;
  platforms: string[];
  aspectRatio: AspectRatio;
  duration: number;
  targetAudience: string[];
  cta: string;
  assetIds: string[];
  notes: string;
  restrictions: string[];
}

export interface Claim {
  id: string;
  text: string;
  type: ClaimType;
  source: string;
  status: ClaimStatus;
  validUntil?: string;
  confidence: number;
}

export interface BrandPackage {
  id: string;
  name: string;
  price: number;
  description: string;
  claimIds: string[];
}

export interface PersonProfile {
  id: string;
  name: string;
  role: string;
  tone: string;
  notes: string;
}

export interface BrandProfile {
  merchant: string;
  tone: string[];
  prohibitedWords: string[];
  packages: BrandPackage[];
  personProfile: PersonProfile;
  facts: Claim[];
}

export interface ScriptComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface ScriptBlock {
  id: string;
  type: ScriptBlockType;
  content: string;
  duration: number;
  claimIds: string[];
  comments: ScriptComment[];
  riskLevel: RiskLevel;
}

export interface ScriptVersion {
  id: string;
  name: string;
  score: number;
  blocks: ScriptBlock[];
  citations: string[];
  estimatedDuration: number;
  createdAt: string;
}

export interface StoryboardShot {
  id: string;
  order: number;
  duration: number;
  description: string;
  shotType: string;
  cameraPosition: string;
  narration: string;
  screenText: string;
  sourceType: AssetSource | 'shoot';
  riskLevel: RiskLevel;
  status: ShotStatus;
  assignee?: string;
  assetId?: string;
  matchStatus: AssetMatchStatus;
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  thumbnail: string;
  duration: number;
  status: AssetMatchStatus;
  tags: string[];
  source: AssetSource;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId?: string;
  label: string;
  start: number;
  end: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'subtitle' | 'overlay';
}

export interface QaItem {
  key: QaCheckKey;
  label: string;
  status: QaCheckStatus;
  message: string;
}

export interface Timeline {
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  duration: number;
  playhead: number;
  aspectRatio: AspectRatio;
  qaStatus: QaItem[];
}

export interface DemoWorkspace {
  project: Project;
  brief: ProjectBrief;
  brand: BrandProfile;
  scripts: ScriptVersion[];
  activeScriptId: string;
  storyboard: StoryboardShot[];
  assets: Asset[];
  timeline: Timeline;
}
