/**
 * TopicEye API Client
 * Backend API wrapper using fetch
 */

import type {
  AuthTokenResponse,
  AuthUser,
  ContentItem,
  CreateSourceRequest,
  IntegrationStatus,
  NotificationListResponse,
  PlanCatalogResponse,
  UpdateSourceRequest,
  WeReadBestBookmarks,
  WeReadBookInfo,
  WeReadReadData,
  WeReadSearchResponse,
  WeReadShelfSync,
  WeReadSyncResult
} from '@/types';
import type {
  ContentCategoryItem,
  ScoringFlowConfig,
  ScoringFlowDiagnostics,
  ScoringFlowResponse,
  ScoringFlowSample,
  ScoringFlowStage,
  TopicGroupResponse,
} from '@/types/contents';
import type {
  EvalResult,
  EvalRun,
  LlmModelCreatePayload,
  LlmModelItem,
  LlmModelPresetCatalog,
  LlmModelPresetItem,
  ModelUsageBucket,
  ModelUsageByModel,
  ModelUsageByPrompt,
  ModelUsageSummary,
} from '@/types/models';
import type {
  IssueFeedbackItem,
  IssueFeedbackListResponse,
  IssueFeedbackSeverity,
  IssueFeedbackStatus,
  ProductUpdateEntry,
  ProductUpdateItem,
  ProductUpdateKind,
  ProductUpdateListResponse,
  ProductUpdateStatus,
} from '@/types/product-feedback';
import type {
  JobStatsByJobKey,
  JobStatsByStatus,
  JobStatsRecentFailure,
  JobStatsResponse,
  RSSHubInstance,
  StatsCategoryItem,
  StatsDashboard,
  StatsNovelPlatform,
  StatsOverview,
  StatsSourceItem,
  StatsTrendItem,
} from '@/types/stats';
import type {
  ContentScoringResult,
  CrossPlatformCluster,
  CrossPlatformSourceItem,
  MotherTopic,
  MotherTopicMutation,
  PersistentTopic,
  TrendingAngleRecommendation,
  TrendingItem,
  TrendingSource,
} from '@/types/trending';
import type {
  TrendEvidenceCalculation,
  TrendEvidenceDailyCount,
  TrendEvidenceFilter,
  TrendEvidenceItem,
  TrendEvidenceRequest,
  TrendEvidenceResponse,
  TrendEvidenceScope,
  TrendEvidenceSummary,
  TrendKeywordItem,
  TrendPoint,
  TrendProvenanceStatus,
} from '@/types/trends';
import type {
  FanqieBook,
  FanqieCategory,
  QimaoBook,
  WebnovelCategoryItem,
  WebnovelMovementItem,
  WebnovelWeeklyReport,
  ZhihuAlbum,
  ZhihuCategory,
} from '@/types/webnovel';

export type { ContentItem, CreateSourceRequest, UpdateSourceRequest };
export type FeedbackType = 'like' | 'dislike' | 'skip' | 'not_relevant' | 'outdated' | 'great_pick';
// 统计类型 re-export 保持向后兼容（外部通过 @/lib/api 导入）
export type {
  ContentCategoryItem, ContentScoringResult, CrossPlatformCluster, CrossPlatformSourceItem, EvalResult, EvalRun, FanqieBook, FanqieCategory, IssueFeedbackItem,
  IssueFeedbackListResponse, IssueFeedbackSeverity,
  IssueFeedbackStatus, JobStatsByJobKey, JobStatsByStatus, JobStatsRecentFailure,
  JobStatsResponse, LlmModelCreatePayload, LlmModelItem, LlmModelPresetCatalog, LlmModelPresetItem, ModelUsageBucket,
  ModelUsageByModel,
  ModelUsageByPrompt,
  ModelUsageSummary, MotherTopic,
  MotherTopicMutation, PersistentTopic, ProductUpdateEntry,
  ProductUpdateItem, ProductUpdateKind, ProductUpdateListResponse, ProductUpdateStatus, QimaoBook, RSSHubInstance, ScoringFlowConfig, ScoringFlowDiagnostics, ScoringFlowResponse, ScoringFlowSample, ScoringFlowStage, StatsCategoryItem, StatsDashboard, StatsNovelPlatform, StatsOverview,
  StatsSourceItem, StatsTrendItem, TopicGroupResponse, TrendEvidenceCalculation,
  TrendEvidenceDailyCount, TrendEvidenceFilter, TrendEvidenceItem, TrendEvidenceRequest, TrendEvidenceResponse, TrendEvidenceScope,
  TrendEvidenceSummary, TrendKeywordItem, TrendPoint, TrendProvenanceStatus, TrendingAngleRecommendation, TrendingItem,
  TrendingSource, WebnovelCategoryItem, WebnovelMovementItem, WebnovelWeeklyReport, ZhihuAlbum,
  ZhihuCategory
};

// Core API infrastructure (request / token / error helpers) extracted to _core.ts
import {
  BASE_URL,
  FAVORITE_STATE_BATCH_SIZE,
  formatApiErrorDetail,
  getAuthToken,
  getAuthTokenExpiresAt,
  request,
  setAuthToken,
  setAuthTokenExpiresAt
} from './api/_core';
export { FAVORITE_STATE_BATCH_SIZE, formatApiErrorDetail, getAuthToken, getAuthTokenExpiresAt, setAuthToken, setAuthTokenExpiresAt };

// ─── Auth API ───

export const authApi = {
  register(data: { email: string; password: string; display_name?: string | null; verification_code: string }): Promise<AuthTokenResponse> {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 发送邮箱验证码（注册前调用）。成功返回 204。 */
  sendCode(email: string): Promise<void> {
    return request('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  login(data: { email: string; password: string }): Promise<AuthTokenResponse> {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  me(): Promise<AuthUser> {
    return request('/auth/me');
  },

  logout(): Promise<{ logged_out: boolean }> {
    return request('/auth/logout', { method: 'POST' });
  },

  /** 续期当前 session（主动调用，返回更新后的 expires_at）。 */
  refresh(): Promise<AuthTokenResponse> {
    return request('/auth/refresh', { method: 'POST' });
  },

  /** 用户自助修改密码（校验旧密码，成功后撤销其他设备会话）。 */
  changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    return request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
  },

  /** OAuth 登录入口 URL。前端用 window.location.href 整页跳转，
   *  后端 302 到 provider 授权页，回调后再 302 回 /oauth/callback（token 走 fragment）。 */
  oauthLoginUrl(provider: 'google' | 'github'): string {
    return `${BASE_URL}/auth/oauth/${provider}/login`;
  },

  /** 已启用的 OAuth provider 列表，前端据此渲染按钮。 */
  async oauthProviders(): Promise<{ providers: string[]; local_no_login_enabled: boolean }> {
    return request('/auth/oauth/providers');
  },
};

// ─── Plans API ───

export const plansApi = {
  list(): Promise<PlanCatalogResponse> {
    return request('/plans');
  },
};

// ─── Notifications API ───

export const notificationsApi = {
  unreadCount(): Promise<{ count: number }> {
    return request('/notifications/unread-count');
  },

  list(params?: { unread?: boolean; limit?: number; offset?: number }): Promise<NotificationListResponse> {
    const query = params
      ? '?' + new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
    return request(`/notifications${query}`);
  },

  markRead(id: number): Promise<{ success: boolean }> {
    return request(`/notifications/${id}/read`, { method: 'POST' });
  },

  markAllRead(): Promise<{ marked: number }> {
    return request('/notifications/read-all', { method: 'POST' });
  },

  delete(id: number): Promise<{ success: boolean }> {
    return request(`/notifications/${id}`, { method: 'DELETE' });
  },
};

// ─── Integrations API ───

export const integrationsApi = {
  getWeRead(): Promise<IntegrationStatus> {
    return request('/integrations/weread');
  },

  updateWeRead(data: { api_key: string; config?: Record<string, unknown> }): Promise<IntegrationStatus> {
    return request('/integrations/weread', {
      method: 'PUT',
      body: JSON.stringify({ api_key: data.api_key, config: data.config || {} }),
    });
  },

  clearWeRead(): Promise<IntegrationStatus> {
    return request('/integrations/weread', { method: 'DELETE' });
  },

  syncWeRead(limit = 0): Promise<WeReadSyncResult> {
    return request(`/integrations/weread/sync?limit=${limit}`, { method: 'POST' });
  },

  searchWeRead(keyword: string, count = 10, scope = 10): Promise<WeReadSearchResponse> {
    const params = new URLSearchParams({ keyword, count: String(count), scope: String(scope) });
    return request(`/integrations/weread/search?${params}`);
  },

  getWeReadBook(bookId: string): Promise<WeReadBookInfo> {
    return request(`/integrations/weread/book/${bookId}`);
  },

  getWeReadReadData(readType: 'all' | 'week' | 'month' | 'year' = 'all', forceRefresh = false): Promise<WeReadReadData> {
    const params = new URLSearchParams({ read_type: readType });
    if (forceRefresh) params.set('force_refresh', 'true');
    return request(`/integrations/weread/readdata?${params}`);
  },

  getWeReadBookmarks(bookId: string, count = 20): Promise<WeReadBestBookmarks> {
    return request(`/integrations/weread/book/${bookId}/bookmarks?count=${count}`);
  },

  getWeReadShelf(forceRefresh = false): Promise<WeReadShelfSync> {
    const params = forceRefresh ? '?force_refresh=true' : '';
    return request(`/integrations/weread/shelf${params}`);
  },
};


// Domain API objects extracted to lib/api/ submodules for module size.
// Re-export for backward compat — `import { sourcesApi } from '@/lib/api'` still works.
export type { UserCreatePayload, UserCreateResponse, UserListItem, UserListResponse, UserUpdatePayload } from '@/types/users';
export { adminPromptsApi, feedbackApi, productFeedbackApi, scoringDashboardApi, settingsApi, statsApi, statsJobsApi, trendsApi } from './api/_analytics';
export type { PromptDetailResponse, PromptRegistryItem, PromptRegistryListResponse, ScoringDashboardResponse, ScoringDashboardSummary } from './api/_analytics';
export { monthlyDigestApi, weeklyDigestApi } from './api/_digests';
export { analysesApi, apiTokensApi, contentCategoriesApi, contentEventsAdminApi, contentsApi, creationApi, dailyReportApi, evidenceApi, favoritesApi, sourcesApi, topicsApi, viralApi } from './api/_domains';
export type {
  ApiTokenItem, ContentEventMutationResponse, ContentEventNormalizationMode,
  ContentEventNormalizationScope, ContentEventNormalizeRequest,
  ContentEventNormalizeResponse, ContentEventRelation, ContentEventReviewItem,
  ContentEventReviewListResponse, ContentEventReviewStatus, EvidenceEffectStats, EvidenceStats, SourceBatchImportItem
} from './api/_domains';
export { modelsApi } from './api/_models';
export { fanqieApi, motherTopicsApi, qimaoApi, webnovelReportsApi, zhihuApi } from './api/_mother-topics';
export { readRecordApi } from './api/_read-records';
export type { ReadRecordReportPayload, ReadRecordResponse, ReadTargetType } from './api/_read-records';
export { trendingApi } from './api/_trending';
export { usersApi } from './api/_users';
