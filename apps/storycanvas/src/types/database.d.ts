// @db-hash 8c0a7051de193b1c625db30b9d60dce6
//该文件由脚本自动生成，请勿手动修改

export interface memories {
  'content': string;
  'createTime': number;
  'embedding'?: string | null;
  'id'?: string;
  'isolationKey': string;
  'name'?: string | null;
  'relatedMessageIds'?: string | null;
  'role'?: string | null;
  'summarized'?: number | null;
  'type': string;
}
export interface o_agentDeploy {
  'desc'?: string | null;
  'disabled'?: boolean | null;
  'id'?: number;
  'key'?: string | null;
  'maxOutputTokens'?: number | null;
  'model'?: string | null;
  'modelName'?: string | null;
  'name'?: string | null;
  'temperature'?: number | null;
  'type'?: string | null;
  'vendorId'?: string | null;
}
export interface o_agentWorkData {
  'createTime'?: number | null;
  'data'?: string | null;
  'episodesId'?: number | null;
  'id'?: number;
  'key'?: string | null;
  'projectId'?: number | null;
  'updateTime'?: number | null;
}
export interface o_artStyle {
  'fileUrl'?: string | null;
  'id'?: number;
  'label'?: string | null;
  'name'?: string | null;
  'prompt'?: string | null;
}
export interface o_assets {
  'assetsId'?: number | null;
  'audioBindState'?: number | null;
  'describe'?: string | null;
  'flowId'?: number | null;
  'id'?: number;
  'imageId'?: number | null;
  'name'?: string | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'promptErrorReason'?: string | null;
  'promptState'?: string | null;
  'remark'?: string | null;
  'scriptId'?: number | null;
  'startTime'?: number | null;
  'type'?: string | null;
}
export interface o_assets2Storyboard {
  'assetId'?: number;
  'storyboardId'?: number;
}
export interface o_assetsRole2Audio {
  'assetsAudioId'?: number;
  'assetsRoleId'?: number;
}
export interface o_event {
  'createTime'?: number | null;
  'detail'?: string | null;
  'id'?: number;
  'name'?: string | null;
}
export interface o_eventChapter {
  'eventId'?: number | null;
  'id'?: number;
  'novelId'?: number | null;
}
export interface o_image {
  'assetsId'?: number | null;
  'errorReason'?: string | null;
  'filePath'?: string | null;
  'id'?: number;
  'model'?: string | null;
  'resolution'?: string | null;
  'state'?: string | null;
  'type'?: string | null;
}
export interface o_imageFlow {
  'flowData': string;
  'id'?: number;
}
export interface o_modelPrompt {
  'fileName'?: string | null;
  'id'?: number;
  'model'?: string | null;
  'path'?: string | null;
  'vendorId'?: string | null;
}
export interface o_novel {
  'chapter'?: string | null;
  'chapterData'?: string | null;
  'chapterIndex'?: number | null;
  'createTime'?: number | null;
  'errorReason'?: string | null;
  'event'?: string | null;
  'eventState'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
  'reel'?: string | null;
}
export interface o_project {
  'artStyle'?: string | null;
  'createTime'?: number | null;
  'directorManual'?: string | null;
  'id'?: number | null;
  'imageModel'?: string | null;
  'imageQuality'?: string | null;
  'intro'?: string | null;
  'mode'?: string | null;
  'name'?: string | null;
  'projectType'?: string | null;
  'type'?: string | null;
  'userId'?: number | null;
  'videoModel'?: string | null;
  'videoRatio'?: string | null;
}
export interface o_prompt {
  'data'?: string | null;
  'id'?: number;
  'name'?: string | null;
  'type'?: string | null;
  'useData'?: string | null;
}
export interface o_script {
  'content'?: string | null;
  'createTime'?: number | null;
  'errorReason'?: string | null;
  'extractState'?: number | null;
  'id'?: number;
  'name'?: string | null;
  'projectId'?: number | null;
}
export interface o_scriptAssets {
  'assetId'?: number;
  'scriptId'?: number;
}
export interface o_setting {
  'key'?: string | null;
  'value'?: string | null;
}
export interface o_skillAttribution {
  'attribution'?: string;
  'skillId'?: string;
}
export interface o_skillList {
  'createTime': number;
  'description': string;
  'embedding'?: string | null;
  'id'?: string;
  'md5': string;
  'name': string;
  'path': string;
  'state': number;
  'type': string;
  'updateTime': number;
}
export interface o_storyboard {
  'createTime'?: number | null;
  'duration'?: string | null;
  'filePath'?: string | null;
  'flowId'?: number | null;
  'id'?: number;
  'index'?: number | null;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'reason'?: string | null;
  'scriptId'?: number | null;
  'shouldGenerateImage'?: number | null;
  'state'?: string | null;
  'track'?: string | null;
  'trackId'?: number | null;
  'videoDesc'?: string | null;
}
export interface o_tasks {
  'describe'?: string | null;
  'id'?: number;
  'model'?: string | null;
  'projectId'?: number | null;
  'reason'?: string | null;
  'relatedObjects'?: string | null;
  'startTime'?: number | null;
  'state'?: string | null;
  'taskClass'?: string | null;
}
export interface o_user {
  'id'?: number;
  'name'?: string | null;
  'password'?: string | null;
}
export interface o_vendorConfig {
  'enable'?: number | null;
  'id'?: string;
  'inputValues'?: string | null;
  'models'?: string | null;
}
export interface o_video {
  'errorReason'?: string | null;
  'filePath'?: string | null;
  'id'?: number;
  'projectId'?: number | null;
  'scriptId'?: number | null;
  'state'?: string | null;
  'time'?: number | null;
  'videoTrackId'?: number | null;
}
export interface o_videoTrack {
  'duration'?: number | null;
  'id'?: number;
  'projectId'?: number | null;
  'prompt'?: string | null;
  'reason'?: string | null;
  'scriptId'?: number | null;
  'selectVideoId'?: number | null;
  'state'?: string | null;
  'videoId'?: number | null;
}
export interface sc_continuity_profiles {
  'createdAt': string;
  'id'?: string | null;
  'projectId': number;
  'revision'?: number;
  'rulesJson'?: string;
  'styleJson'?: string;
  'updatedAt': string;
}
export interface sc_continuity_reviews {
  'createdAt': string;
  'id'?: string | null;
  'issuesJson'?: string;
  'observedStateJson'?: string;
  'projectId': number;
  'shotId': number;
  'status': string;
  'taskId'?: string | null;
}
export interface sc_edit_commands {
  'createdAt': string;
  'editSessionId': string;
  'id'?: string | null;
  'instruction': string;
  'status': string;
  'taskId'?: string | null;
}
export interface sc_edit_sessions {
  'createdAt': string;
  'currentTimelineVersionId'?: string | null;
  'id'?: string | null;
  'openStorylineSessionId'?: string | null;
  'outputAssetId'?: string | null;
  'previewAssetId'?: string | null;
  'projectId': number;
  'status': string;
  'updatedAt': string;
}
export interface sc_entities {
  'canonicalJson'?: string;
  'createdAt': string;
  'entityType': string;
  'id'?: string | null;
  'locked'?: boolean;
  'name': string;
  'projectId': number;
  'slug': string;
  'updatedAt': string;
}
export interface sc_entity_versions {
  'appearanceJson'?: string;
  'approved'?: boolean;
  'createdAt': string;
  'entityId': string;
  'id'?: string | null;
  'stateJson'?: string;
  'version': number;
}
export interface sc_export_artifacts {
  'assetId': string;
  'checksum': string;
  'createdAt': string;
  'externalProjectId': string;
  'id'?: string | null;
  'mode': string;
  'packageId': string;
  'projectId': number;
  'scriptVersionId': string;
  'sourceChainJson': string;
  'status': string;
  'storageReference': string;
  'taskId'?: string | null;
  'timelineVersionId'?: string | null;
}
export interface sc_external_mappings {
  'createdAt': string;
  'entityType': string;
  'externalId': string;
  'id'?: string | null;
  'localId': string;
  'metadataJson'?: string;
  'system': string;
}
export interface sc_media_assets {
  'byteSize': number;
  'createdAt': string;
  'durationMs'?: number | null;
  'fps'?: number | null;
  'height'?: number | null;
  'id'?: string | null;
  'imageId'?: number | null;
  'localPath': string;
  'metadataJson'?: string;
  'mimeType': string;
  'originalName'?: string | null;
  'projectId': number;
  'prompt'?: string | null;
  'provider'?: string | null;
  'remoteUrl'?: string | null;
  'rightsNote'?: string | null;
  'sha256': string;
  'source': string;
  'thumbnailPath'?: string | null;
  'type': string;
  'videoId'?: number | null;
  'width'?: number | null;
}
export interface sc_migrations {
  'appliedAt': string;
  'checksum': string;
  'version'?: string | null;
}
export interface sc_production_package_attempts {
  'contractVersion'?: string | null;
  'createdAt': string;
  'errorCode'?: string | null;
  'errorJson'?: string | null;
  'externalProjectId'?: string | null;
  'id'?: string | null;
  'idempotencyKey'?: string | null;
  'packageId'?: string | null;
  'packageRecordId'?: string | null;
  'packageVersion'?: number | null;
  'payloadDigest': string;
  'snapshotJson': string;
  'sourceSuiteDigest': string;
  'status': string;
  'tenantId'?: string | null;
}
export interface sc_production_packages {
  'acceptedAt'?: string | null;
  'capabilityIdsJson'?: string;
  'contractVersion'?: string | null;
  'createdAt': string;
  'errorCode'?: string | null;
  'errorJson'?: string | null;
  'externalProjectId'?: string | null;
  'id'?: string | null;
  'idempotencyKey': string;
  'internalProjectId'?: number | null;
  'packageId'?: string | null;
  'packageVersion'?: number | null;
  'payloadDigest': string;
  'snapshotJson': string;
  'sourceSuiteDigest': string;
  'status': string;
  'tenantId'?: string | null;
}
export interface sc_project_profile {
  'briefJson'?: string | null;
  'category': string;
  'createdAt': string;
  'currentScriptVersionId'?: string | null;
  'currentTimelineVersionId'?: string | null;
  'projectId'?: number | null;
  'status'?: string;
  'updatedAt': string;
}
export interface sc_receipt_outbox {
  'acknowledgedAt'?: string | null;
  'businessId': string;
  'createdAt': string;
  'deliveredAt'?: string | null;
  'deliveryId'?: string | null;
  'externalProjectId': string;
  'id'?: string | null;
  'idempotencyKey': string;
  'lastAttempt'?: string | null;
  'lastErrorJson'?: string | null;
  'packageId': string;
  'payloadDigest': string;
  'payloadJson': string;
  'projectId': number;
  'receiptType': string;
  'retryCount'?: number;
  'status'?: string;
  'updatedAt': string;
}
export interface sc_reference_bindings {
  'approved'?: boolean;
  'assetId'?: string | null;
  'createdAt': string;
  'entityId'?: string | null;
  'id'?: string | null;
  'priority'?: number;
  'projectId': number;
  'role': string;
  'shotId'?: number | null;
  'sourceUri'?: string | null;
  'view'?: string;
}
export interface sc_scenes {
  'description'?: string;
  'id'?: string | null;
  'location'?: string;
  'projectId': number;
  'sortOrder': number;
  'title': string;
}
export interface sc_script_versions {
  'createdAt': string;
  'id'?: string | null;
  'projectId': number;
  'scriptId'?: number | null;
  'source': string;
  'structuredJson': string;
  'version': number;
}
export interface sc_shot_contracts {
  'actionJson'?: string;
  'cameraJson'?: string;
  'entitySlugsJson'?: string;
  'mustPreserveJson'?: string;
  'projectId'?: number;
  'requiredStateJson'?: string;
  'shotId'?: number;
  'statePatchJson'?: string;
  'transitionJson'?: string;
  'updatedAt': string;
  'worldRevision': number;
}
export interface sc_shot_metadata {
  'cameraMovement': string;
  'durationSeconds': number;
  'generationStatus'?: string;
  'imagePrompt': string;
  'locked'?: boolean;
  'materialStrategy': string;
  'narration'?: string;
  'onScreenText'?: string;
  'sceneId': string;
  'shotType': string;
  'sortOrder': number;
  'storyboardId'?: number | null;
  'transitionName'?: string;
  'videoPrompt': string;
  'visualDescription': string;
}
export interface sc_shot_relations {
  'createdAt': string;
  'fromShotId': number;
  'id'?: string | null;
  'matchOn'?: string | null;
  'preserveJson'?: string;
  'projectId': number;
  'relationType': string;
  'toShotId': number;
  'updatedAt': string;
  'usePreviousEndFrame'?: boolean;
}
export interface sc_tasks {
  'actualCost'?: number | null;
  'createdAt': string;
  'errorJson'?: string | null;
  'estimatedCost'?: number | null;
  'externalTaskId'?: string | null;
  'id'?: string | null;
  'idempotencyKey': string;
  'inputJson'?: string;
  'outputJson'?: string | null;
  'progress'?: number;
  'projectId': number;
  'provider': string;
  'status': string;
  'storyboardId'?: number | null;
  'taskType': string;
  'updatedAt': string;
}
export interface sc_timeline_versions {
  'createdAt': string;
  'editSessionId': string;
  'id'?: string | null;
  'projectId': number;
  'source': string;
  'tracksJson': string;
  'version': number;
}
export interface sc_world_events {
  'afterShotId'?: number | null;
  'createdAt': string;
  'eventType': string;
  'id'?: string | null;
  'preconditionsJson'?: string;
  'projectId': number;
  'sortOrder': number;
  'statePatchJson'?: string;
  'title': string;
}

export interface DB {
  "memories": memories;
  "o_agentDeploy": o_agentDeploy;
  "o_agentWorkData": o_agentWorkData;
  "o_artStyle": o_artStyle;
  "o_assets": o_assets;
  "o_assets2Storyboard": o_assets2Storyboard;
  "o_assetsRole2Audio": o_assetsRole2Audio;
  "o_event": o_event;
  "o_eventChapter": o_eventChapter;
  "o_image": o_image;
  "o_imageFlow": o_imageFlow;
  "o_modelPrompt": o_modelPrompt;
  "o_novel": o_novel;
  "o_project": o_project;
  "o_prompt": o_prompt;
  "o_script": o_script;
  "o_scriptAssets": o_scriptAssets;
  "o_setting": o_setting;
  "o_skillAttribution": o_skillAttribution;
  "o_skillList": o_skillList;
  "o_storyboard": o_storyboard;
  "o_tasks": o_tasks;
  "o_user": o_user;
  "o_vendorConfig": o_vendorConfig;
  "o_video": o_video;
  "o_videoTrack": o_videoTrack;
  "sc_continuity_profiles": sc_continuity_profiles;
  "sc_continuity_reviews": sc_continuity_reviews;
  "sc_edit_commands": sc_edit_commands;
  "sc_edit_sessions": sc_edit_sessions;
  "sc_entities": sc_entities;
  "sc_entity_versions": sc_entity_versions;
  "sc_export_artifacts": sc_export_artifacts;
  "sc_external_mappings": sc_external_mappings;
  "sc_media_assets": sc_media_assets;
  "sc_migrations": sc_migrations;
  "sc_production_package_attempts": sc_production_package_attempts;
  "sc_production_packages": sc_production_packages;
  "sc_project_profile": sc_project_profile;
  "sc_receipt_outbox": sc_receipt_outbox;
  "sc_reference_bindings": sc_reference_bindings;
  "sc_scenes": sc_scenes;
  "sc_script_versions": sc_script_versions;
  "sc_shot_contracts": sc_shot_contracts;
  "sc_shot_metadata": sc_shot_metadata;
  "sc_shot_relations": sc_shot_relations;
  "sc_tasks": sc_tasks;
  "sc_timeline_versions": sc_timeline_versions;
  "sc_world_events": sc_world_events;
}
