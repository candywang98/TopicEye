/**
 * TopicEye Shared Utilities
 * Pure functions used across multiple pages
 */

import type { ContentItem, ContentAnalysis } from '@/types';
import { explainRecommendation } from '@/lib/recommendation';

// ─── timeAgo ───
// timeAgo / parseUTC / formatDateTime 等时间工具已统一迁移到 @/lib/datetime。
// 这里 re-export timeAgo 以保持既有 `import { timeAgo } from '@/lib/utils'` 不变。
export { timeAgo } from '@/lib/datetime';

// ─── weightStars ───

export const weightStars = (w: number) =>
  '●'.repeat(Math.min(w, 5)) + '○'.repeat(Math.max(5 - w, 0));

// ─── Analysis extract helpers (topics/[id] page) ───

export function extractRiskNotes(analysis: ContentAnalysis | null): string[] {
  let candidate: unknown = analysis?.risk_notes;
  if (!candidate) return [];

  if (typeof candidate === 'string') {
    const text = candidate.trim();
    if (!text) return [];
    try {
      candidate = JSON.parse(text) as unknown;
    } catch {
      return [text];
    }
  }

  if (typeof candidate === 'string') {
    return candidate.trim() ? [candidate.trim()] : [];
  }
  if (Array.isArray(candidate)) {
    return normalizeStringList(candidate);
  }
  if (typeof candidate === 'object') {
    return [...new Set(
      Object.values(candidate as Record<string, unknown>)
        .flatMap((value) => normalizeStringList(value)),
    )];
  }
  return [];
}

export function normalizeStringList(value: unknown): string[] {
  let candidate = value;

  if (typeof candidate === 'string') {
    const text = candidate.trim();
    if (!text) return [];

    try {
      candidate = JSON.parse(text) as unknown;
    } catch {
      candidate = text;
    }
  }

  if (typeof candidate === 'string') {
    candidate = [candidate];
  }
  if (!Array.isArray(candidate)) return [];

  return [...new Set(
    candidate
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

export function normalizeTagList(value: unknown): string[] {
  if (typeof value !== 'string') return normalizeStringList(value);

  const text = value.trim();
  if (!text) return [];
  try {
    return normalizeStringList(JSON.parse(text) as unknown);
  } catch {
    return [...new Set(text.split(',').map((tag) => tag.trim()).filter(Boolean))];
  }
}

export function extractCreatorAngles(analysis: ContentAnalysis | null): string[] {
  return normalizeStringList(analysis?.creator_angles);
}

export function extractTags(item: ContentItem, analysis: ContentAnalysis | null): string[] {
  return [...new Set([
    ...normalizeTagList(item.tags),
    ...normalizeTagList(analysis?.tags),
  ])];
}

export function extractTitleSuggestions(analysis: ContentAnalysis | null): string[] {
  return normalizeStringList(analysis?.title_suggestions);
}

export function extractKeyPoints(analysis: ContentAnalysis | null): string[] {
  return normalizeStringList(analysis?.key_points);
}

// ─── Tag color helper (today-picks) ───

import { T } from '@/lib/design-tokens';

const TAG_COLORS: Record<string, string> = {
  '模型': '#8B5CF6', '产品': '#3B82F6', '行业': '#10B981',
  '论文': '#6366F1', '技巧': '#F59E0B', '开源': '#EF4444',
  '工具': '#EC4899', '趋势': '#14B8A6', '大佬': '#F97316',
  '智能体': '#06B6D4', '具身智能': '#84CC16', '编码': '#A855F7',
};

export function getTagColor(tag: string): string {
  return TAG_COLORS[tag] || T.gray400;
}

// ─── Recommend level label (today-picks) ───

export function getRecommendLevelLabel(analysis: ContentAnalysis): string {
  return explainRecommendation(analysis).level;
}

// ─── Creation plan formatter ───

export function formatPlanText(plan: Record<string, unknown>): string {
  const lines: string[] = [];
  const p = plan as Record<string, unknown>;
  const titles = p.titles as string[] | undefined;
  if (titles) {
    lines.push('【备选标题】');
    titles.forEach((t: string, i: number) => lines.push(`${i + 1}. ${t}`));
    lines.push('');
  }
  const coverSlogan = p.cover_slogan as string | undefined;
  if (coverSlogan) lines.push(`封面文案：${coverSlogan}\n`);
  const structure = p.structure as Record<string, unknown> | undefined;
  if (structure) {
    lines.push('【正文结构】');
    const hook = structure.hook as string | undefined;
    if (hook) lines.push(`Hook: ${hook}`);
    const points = structure.points as string[] | undefined;
    points?.forEach((pt: string) => lines.push(`- ${pt}`));
    const cta = structure.cta as string | undefined;
    if (cta) lines.push(`互动引导: ${cta}`);
    lines.push('');
  }
  const scenes = p.scenes as Array<Record<string, unknown>> | undefined;
  if (scenes) {
    lines.push('【分镜头脚本】');
    scenes.forEach((s) => lines.push(`镜头${s.seq}(${s.seconds}s): ${s.visual}\n旁白: ${s.narration}`));
    lines.push('');
  }
  const outline = p.outline as Array<Record<string, unknown>> | undefined;
  if (outline) {
    lines.push('【文章大纲】');
    outline.forEach((s) => {
      lines.push(`${s.section}. ${s.heading}`);
      const sPoints = s.points as string[] | undefined;
      sPoints?.forEach((pt: string) => lines.push(`  • ${pt}`));
    });
    lines.push('');
  }
  const tags = p.tags as string[] | undefined;
  if (tags) lines.push(`标签：${tags.map((t: string) => `#${t}`).join(' ')}`);
  const tone = p.tone as string | undefined;
  if (tone) lines.push(`风格：${tone}`);
  return lines.join('\n');
}
