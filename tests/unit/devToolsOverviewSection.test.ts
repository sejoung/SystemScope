import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  DockerOpenButton,
  DockerQuickActions,
  OverviewRefreshButton,
} from '../../src/renderer/src/features/devtools/DevToolsOverviewSection'

describe('DevToolsOverviewSection UI helpers', () => {
  it('renders the refresh action for the overview toolbar', () => {
    const markup = renderToStaticMarkup(
      createElement(OverviewRefreshButton, {
        loading: false,
        label: 'Refresh All',
        onClick: vi.fn(),
      }),
    )

    expect(markup).toContain('Refresh All')
  })

  it('renders docker navigation actions for the runtime card', () => {
    const markup = renderToStaticMarkup(
      createElement('div', {}, [
        createElement(DockerOpenButton, {
          key: 'open',
          label: 'Open Docker',
          onClick: vi.fn(),
        }),
        createElement(DockerQuickActions, {
          key: 'actions',
          labels: {
            containers: 'Containers',
            images: 'Docker Images',
            volumes: 'Volumes',
            buildCache: 'Build Cache',
          },
          onOpenContainers: vi.fn(),
          onOpenImages: vi.fn(),
          onOpenVolumes: vi.fn(),
          onOpenBuildCache: vi.fn(),
        }),
      ]),
    )

    expect(markup).toContain('Open Docker')
    expect(markup).toContain('Containers')
    expect(markup).toContain('Docker Images')
    expect(markup).toContain('Volumes')
    expect(markup).toContain('Build Cache')
  })
})
