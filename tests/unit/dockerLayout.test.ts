import { describe, expect, it } from "vitest";
import { shouldUseDockerContainersCompactLayout } from "../../src/renderer/src/features/docker/DockerContainers";
import { shouldUseDockerImagesCompactLayout } from "../../src/renderer/src/features/disk/DockerImages";
import { shouldUseDockerVolumesCompactLayout } from "../../src/renderer/src/features/docker/DockerVolumes";
import { shouldUseDockerPageCompactLayout } from "../../src/renderer/src/pages/DockerPage";

describe("Docker layout helpers", () => {
  it("switches docker containers to compact layout below the width threshold", () => {
    expect(shouldUseDockerContainersCompactLayout(720)).toBe(true);
    expect(shouldUseDockerContainersCompactLayout(979)).toBe(true);
    expect(shouldUseDockerContainersCompactLayout(980)).toBe(false);
  });

  it("switches docker images to compact layout below the width threshold", () => {
    expect(shouldUseDockerImagesCompactLayout(720)).toBe(true);
    expect(shouldUseDockerImagesCompactLayout(979)).toBe(true);
    expect(shouldUseDockerImagesCompactLayout(980)).toBe(false);
  });

  it("switches docker volumes to compact layout below the width threshold", () => {
    expect(shouldUseDockerVolumesCompactLayout(720)).toBe(true);
    expect(shouldUseDockerVolumesCompactLayout(979)).toBe(true);
    expect(shouldUseDockerVolumesCompactLayout(980)).toBe(false);
  });

  it("switches docker page tabs to compact layout below the width threshold", () => {
    expect(shouldUseDockerPageCompactLayout(720)).toBe(true);
    expect(shouldUseDockerPageCompactLayout(979)).toBe(true);
    expect(shouldUseDockerPageCompactLayout(980)).toBe(false);
  });
});
