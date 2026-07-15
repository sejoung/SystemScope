import type { CSSProperties } from 'react'
import type { TranslateFn } from '@shared/i18n'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { CompactMetaItem } from '../../components/ui/CompactPrimitives'
import { detailBlockStyle, detailGridStyle, detailLabelStyle, detailPanelStyle, detailValueStyle, detailsBodyTextStyle } from './appsShared'

export function renderLeftoverDetails(
  item: { path: string; reason: string; risk: string },
  tk: TranslateFn,
) {
  return (
    <div style={detailPanelStyle}>
      <div style={detailGridStyle}>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.table.location")}</strong>
          <div style={detailValueStyle}>
            <CopyableValue value={item.path} fontSize="12px" color="var(--text-secondary)" multiline />
          </div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.reason.why")}</strong>
          <div style={detailsBodyTextStyle}>{tk(item.reason)}</div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.reason.risk")}</strong>
          <div style={detailsBodyTextStyle}>{tk(item.risk)}</div>
        </div>
      </div>
    </div>
  );
}

export function CompactMeta({
  label,
  value,
  mono = false,
  multiline = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  muted?: boolean;
}) {
  return <CompactMetaItem label={label} value={value} mono={mono} multiline={multiline} muted={muted} />;
}

export const compactCardTitleWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "10px",
  minWidth: 0,
  cursor: "pointer",
};

export const compactTitleStyle: CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "var(--text-primary)",
};

export const compactBadgeStackStyle: CSSProperties = {
  display: "flex",
  gap: "6px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};
