import { lazy } from 'react'

export const DashboardPage = lazy(async () => import('./DashboardPage').then((module) => ({ default: module.DashboardPage })))
export const TimelinePage = lazy(async () => import('./TimelinePage').then((module) => ({ default: module.TimelinePage })))
export const DiskAnalysisPage = lazy(async () => import('./DiskAnalysisPage').then((module) => ({ default: module.DiskAnalysisPage })))
export const DockerPage = lazy(async () => import('./DockerPage').then((module) => ({ default: module.DockerPage })))
export const CleanupPage = lazy(async () => import('./CleanupPage').then((module) => ({ default: module.CleanupPage })))
export const ProcessPage = lazy(async () => import('./ProcessPage').then((module) => ({ default: module.ProcessPage })))
export const DevToolsPage = lazy(async () => import('./DevToolsPage').then((module) => ({ default: module.DevToolsPage })))
export const AppsPage = lazy(async () => import('./AppsPage').then((module) => ({ default: module.AppsPage })))
export const SettingsPage = lazy(async () => import('./SettingsPage').then((module) => ({ default: module.SettingsPage })))
