import type { CSSProperties } from 'react'
import type { AppRelatedDataItem, InstalledApp } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { CompactMetaItem } from '../../components/ui/CompactPrimitives'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { detailsBodyTextStyle, detailsHeaderStyle, detailsMetaStyle, detailsTitleStyle, relatedEmptyStyle, relatedItemStyle, relatedPanelStyle } from './appsShared'

export function CompactMeta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <CompactMetaItem label={label} value={value} mono={mono} />;
}

export function renderRelatedDataPanel({
  entry,
  tk,
  relatedLoadingAppId,
  relatedDataByAppId,
  selectedRelatedIdsByAppId,
  handleToggleRelatedId,
}: {
  entry: InstalledApp;
  tk: TranslateFn;
  relatedLoadingAppId: string | null;
  relatedDataByAppId: Record<string, AppRelatedDataItem[]>;
  selectedRelatedIdsByAppId: Record<string, string[]>;
  handleToggleRelatedId: (appId: string, itemId: string) => void;
}) {
  return (
    <div style={relatedPanelStyle}>
      <div style={detailsHeaderStyle}>
        <div>
          <div style={detailsTitleStyle}>{tk("apps.related.title")}</div>
          <div style={detailsBodyTextStyle}>{tk("apps.related.description")}</div>
        </div>
        <div style={detailsMetaStyle}>
          {tk("common.selected", { count: (selectedRelatedIdsByAppId[entry.id] ?? []).length })}
        </div>
      </div>
      {relatedLoadingAppId === entry.id ? (
        <div style={relatedEmptyStyle}>{tk("apps.related.loading")}</div>
      ) : (relatedDataByAppId[entry.id] ?? []).length === 0 ? (
        <div style={relatedEmptyStyle}>{tk("apps.related.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {(relatedDataByAppId[entry.id] ?? []).map((item) => {
            const checked = (selectedRelatedIdsByAppId[entry.id] ?? []).includes(item.id);
            return (
              <label key={item.id} style={relatedItemStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleToggleRelatedId(entry.id, item.id)}
                />
                <div style={{ display: "grid", gap: "3px" }}>
                  <span style={detailsTitleStyle}>{item.label}</span>
                  <div style={detailsBodyTextStyle}>
                    <CopyableValue value={item.path} fontSize="12px" color="var(--text-muted)" multiline />
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const compactTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

export const compactLocationBlockStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
};
