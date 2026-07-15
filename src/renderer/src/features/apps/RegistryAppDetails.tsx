import type { CSSProperties } from 'react'
import type { AppLeftoverRegistryItem } from '@shared/types'
import type { TranslateFn } from '@shared/i18n'
import { CopyableValue } from '../../components/ui/CopyableValue'
import { CompactMetaItem } from '../../components/ui/CompactPrimitives'
import { detailBlockStyle, detailGridStyle, detailLabelStyle, detailPanelStyle, detailValueStyle } from './appsShared'

export function renderRegistryDetails(
  item: AppLeftoverRegistryItem,
  tk: TranslateFn,
) {
  return (
    <div style={detailPanelStyle}>
      <div style={detailGridStyle}>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.registry.path")}</strong>
          <div style={detailValueStyle}>
            <CopyableValue value={item.registryPath} fontSize="12px" color="var(--text-secondary)" multiline />
          </div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.registry.install_location")}</strong>
          <div style={detailValueStyle}>
            <CopyableValue value={item.installLocation ?? ""} emptyValue="-" fontSize="12px" color="var(--text-secondary)" multiline />
          </div>
        </div>
        <div style={detailBlockStyle}>
          <strong style={detailLabelStyle}>{tk("apps.registry.uninstall_command")}</strong>
          <div style={detailValueStyle}>
            <CopyableValue value={item.uninstallCommand ?? ""} emptyValue="-" fontSize="12px" color="var(--text-secondary)" multiline />
          </div>
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
