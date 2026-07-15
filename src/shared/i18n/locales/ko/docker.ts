export const KO_DOCKER_MESSAGES = {
  "docker.page.title": "도커·컨테이너",
  "docker.ipc.confirm.delete": "삭제",
  "docker.containers.remove_selected": "선택 제거",
  "docker.ipc.confirm.stop": "중지",
  "docker.volumes.title": "볼륨",
  "docker.overview.card.build_cache": "빌드 캐시",
  "docker.images.title": "도커 이미지",
  "docker.section.overview": "도커 개요",
  "docker.section.containers": "도커 컨테이너",
  "docker.section.volumes": "도커 볼륨",
  "docker.section.build_cache": "도커 빌드 캐시",
  "docker.build_cache.active": "활성",
  "docker.containers.table.ports": "포트",
  "docker.images.in_use": "사용 중",
  "docker.images.scan_action": "이미지 스캔",
  "docker.build_cache.prune": "캐시 정리",
  "docker.build_cache.entries": "캐시 항목",
  "docker.build_cache.total_size": "총 크기",
  "docker.build_cache.reclaimable": "회수 가능",
  "docker.build_cache.retry_refresh": "Refresh로 다시 시도하세요.",
  "docker.volumes.partial": "일부 실패: {message}",
  "docker.ipc.error.no_volumes": "삭제할 Docker 볼륨이 없습니다.",
  "docker.ipc.error.no_volumes_found":
    "삭제할 Docker 볼륨을 찾을 수 없습니다.",
  "docker.ipc.confirm.volumes_title": "Docker 볼륨 삭제",
  "docker.ipc.confirm.cache_detail": "현재 회수 가능 용량: {size}",
  "docker.overview.action.prune": "정리",
  "docker.ipc.confirm.total_size": "총 크기: {size}",
  "docker.ipc.confirm.more": "- ... 외 {count}개",
  "docker.containers.badge": "{count}개 컨테이너",
  "docker.containers.table.container": "컨테이너",
  "docker.containers.table.image": "이미지",
  "docker.containers.table.writable": "쓰기 가능 용량",
  "docker.containers.deleted":
    "{count}개 Docker 컨테이너를 삭제했습니다.",
  "docker.containers.stopped":
    "{count}개 Docker 컨테이너를 중지했습니다.",
  "docker.containers.stop_running": "running {count}개 중지",
  "docker.containers.initial": "Docker 컨테이너를 조회해보세요.",
  "docker.ipc.error.list_containers": "Docker 컨테이너를 조회할 수 없습니다.",
  "docker.ipc.error.remove_containers":
    "Docker 컨테이너를 삭제할 수 없습니다.",
  "docker.ipc.error.stop_containers": "Docker 컨테이너를 중지할 수 없습니다.",
  "docker.common.check_status":
    "Docker Desktop 또는 Docker Engine 상태를 확인하세요.",
  "docker.build_cache.initial": "Docker build cache를 조회해보세요.",
  "docker.ipc.error.build_cache":
    "Docker build cache를 조회할 수 없습니다.",
  "docker.volumes.badge": "{count}개 볼륨",
  "docker.volumes.table.driver": "드라이버",
  "docker.volumes.table.attached": "연결된 컨테이너",
  "docker.volumes.deleted": "{count}개 Docker 볼륨을 삭제했습니다.",
  "docker.volumes.initial": "Docker 볼륨을 조회해보세요.",
  "docker.ipc.error.list_volumes": "Docker 볼륨을 조회할 수 없습니다.",
  "docker.ipc.error.remove_volumes": "Docker 볼륨을 삭제할 수 없습니다.",
  "docker.volumes.empty_detail":
    "사용 중이 아닌 볼륨만 여기서 정리할 수 있습니다.",
  "docker.volumes.helper":
    "컨테이너에서 붙잡고 있는 볼륨은 삭제할 수 없습니다.",
  "docker.images.badge": "{count}개 이미지",
  "docker.images.repository": "리포지토리",
  "docker.images.tag": "태그",
  "docker.images.created": "생성 시점",
  "docker.images.untagged": "태그 없음 (<none>)",
  "docker.images.deleted": "{count}개 Docker 이미지를 삭제했습니다.",
  "docker.images.initial": "Docker 이미지를 조회해보세요.",
  "docker.ipc.error.list_images": "Docker 이미지를 조회할 수 없습니다.",
  "docker.ipc.error.remove_images": "Docker 이미지를 삭제할 수 없습니다.",
  "docker.images.empty_detail":
    "Docker가 설치되어 있다면 Scan Images로 다시 확인할 수 있습니다.",
  "docker.images.helper":
    "사용 중인 이미지는 먼저 Containers 탭에서 참조 컨테이너를 정리해야 합니다. Untagged (<none>) 이미지는 repository 또는 tag가 끊어진 고아 이미지입니다.",
  "docker.ipc.confirm.images_note":
    "사용 중인 이미지는 삭제 대상에서 제외됩니다.",
  "docker.ipc.confirm.containers_note":
    "실행 중인 컨테이너는 삭제 대상에서 제외됩니다.",
  "docker.ipc.confirm.volumes_note":
    "사용 중인 볼륨은 삭제 대상에서 제외됩니다.",
  "docker.ipc.confirm.stop_note":
    "중지 후 컨테이너 탭에서 삭제하거나 이미지 탭에서 참조 이미지를 정리할 수 있습니다.",
  "docker.ipc.error.no_images": "삭제할 Docker 이미지가 없습니다.",
  "docker.ipc.error.no_images_found":
    "삭제할 Docker 이미지를 찾을 수 없습니다.",
  "docker.ipc.error.images_in_use":
    "사용 중인 Docker 이미지는 삭제할 수 없습니다.",
  "docker.ipc.error.no_containers":
    "삭제할 Docker 컨테이너가 없습니다.",
  "docker.ipc.error.no_containers_found":
    "삭제할 Docker 컨테이너를 찾을 수 없습니다.",
  "docker.ipc.error.running_containers":
    "실행 중인 Docker 컨테이너는 먼저 중지해야 합니다.",
  "docker.ipc.error.no_stop_targets":
    "중지할 Docker 컨테이너가 없습니다.",
  "docker.ipc.error.no_stop_found":
    "중지할 Docker 컨테이너를 찾을 수 없습니다.",
  "docker.ipc.error.already_stopped":
    "이미 중지된 컨테이너는 중지할 수 없습니다.",
  "main.docker.images.empty": "Docker 이미지가 없습니다.",
  "docker.containers.empty_title":
    "정리할 Docker 컨테이너가 없습니다.",
  "main.docker.volumes.empty": "Docker 볼륨이 없습니다.",
  "main.docker.build_cache.empty":
    "정리할 Docker build cache가 없습니다.",
  "main.docker.status.not_installed":
    "Docker가 설치되어 있지 않습니다. Docker Desktop 또는 Docker Engine을 설치한 뒤 다시 시도하세요.",
  "main.docker.status.daemon_unavailable":
    "Docker는 설치되어 있지만 현재 실행 중이 아닙니다. Docker Desktop 또는 Docker Engine을 시작한 뒤 다시 시도하세요.",
  "main.docker.images.invalid_id": "이미지 {id}: 유효하지 않은 ID입니다.",
  "main.docker.images.delete_failed": "이미지 {id} 삭제에 실패했습니다.",
  "main.docker.containers.invalid_id": "컨테이너 {id}: 유효하지 않은 ID입니다.",
  "main.docker.containers.delete_failed": "컨테이너 {id} 삭제에 실패했습니다.",
  "main.docker.containers.stop_failed": "컨테이너 {id} 중지에 실패했습니다.",
  "main.docker.volumes.invalid_name": "볼륨 {name}: 유효하지 않은 이름입니다.",
  "main.docker.volumes.delete_failed": "볼륨 {name} 삭제에 실패했습니다.",
  "docker.ipc.confirm.images_title": "Docker 이미지 삭제",
  "docker.ipc.confirm.images_message":
    "{count}개의 Docker 이미지를 삭제하시겠습니까?",
  "docker.ipc.confirm.containers_title": "Docker 컨테이너 삭제",
  "docker.ipc.confirm.containers_message":
    "{count}개의 Docker 컨테이너를 삭제하시겠습니까?",
  "docker.ipc.confirm.stop_title": "Docker 컨테이너 중지",
  "docker.ipc.confirm.stop_message":
    "{count}개의 Docker 컨테이너를 중지하시겠습니까?",
  "docker.ipc.confirm.volumes_message":
    "{count}개의 Docker 볼륨을 삭제하시겠습니까?",
  "docker.ipc.confirm.cache_title": "Docker Build Cache 정리",
  "docker.ipc.confirm.cache_message":
    "Docker build cache를 정리하시겠습니까?",
  "docker.containers.stopped_by_app": "Exited (SystemScope에서 중지됨)",
  "docker.overview.status.ready": "Docker 정리 요약",
  "docker.overview.status.partial": "Docker 정리 요약 (일부만 로드됨)",
  "docker.overview.ready_detail":
    "종료된 컨테이너를 먼저 정리하면 참조 때문에 막히는 이미지 삭제를 줄일 수 있습니다.",
  "docker.overview.partial_detail":
    "일부 Docker 리소스를 불러오지 못했습니다. Docker Desktop 또는 Docker Engine 상태를 확인하세요.",
  "docker.overview.card.stopped_containers": "중지된 컨테이너",
  "docker.overview.card.running_containers": "실행 중인 컨테이너",
  "docker.overview.card.in_use_images": "사용 중인 이미지",
  "docker.overview.card.untagged_images": "태그 없는 이미지 (<none>)",
  "docker.overview.card.unused_volumes": "미사용 볼륨",
  "docker.overview.action.clean_first": "먼저 정리",
  "docker.overview.action.view": "보기",
  "docker.overview.action.inspect": "확인",
  "docker.overview.action.review": "검토",
  "docker.overview.flow.title": "추천 순서",
  "docker.overview.flow.step1_title": "1. 중지된 컨테이너 정리",
  "docker.overview.flow.step1_detail":
    "중지된 컨테이너 {count}개를 먼저 제거하면 이미지 참조가 풀립니다.",
  "docker.overview.flow.step2_title": "2. 사용하지 않는 이미지 삭제",
  "docker.overview.flow.step2_detail":
    "지금 바로 정리 가능한 이미지에서 {size}를 회수할 수 있습니다.",
  "docker.overview.flow.step3_title":
    "3. 미사용 볼륨과 빌드 캐시 정리",
  "docker.overview.flow.step3_detail":
    "미사용 볼륨 {volumes}개와 빌드 캐시 {cache}를 추가로 회수할 수 있습니다.",
  "docker.page.retry": "다시 시도",
  "Docker Resources": "Docker 리소스",
  "docker.build_cache.empty_info": "Docker 빌드 캐시 정보가 없습니다.",
  "docker.build_cache.load_failed": "Docker build cache를 조회할 수 없습니다.",
  "docker.build_cache.prune_failed": "Docker 빌드 캐시를 정리할 수 없습니다.",
  "docker.build_cache.title": "빌드 캐시",
  "docker.containers.delete_failed": "Docker 컨테이너를 삭제할 수 없습니다.",
  "docker.containers.empty_detail": "중지된 컨테이너가 있으면 이미지 탭으로 이동하기 전에 여기서 정리하세요.",
  "docker.containers.helper": "중지된 컨테이너를 먼저 정리하면 이미지 탭에서 사용 중으로 차단된 이미지를 삭제할 수 있습니다.",
  "docker.containers.load_failed": "Docker 컨테이너를 조회할 수 없습니다.",
  "docker.containers.open_images": "이미지 열기",
  "docker.containers.running": "실행 중",
  "docker.containers.stop_failed": "Docker 컨테이너를 중지할 수 없습니다.",
  "docker.containers.stopped_label": "중지됨",
  "docker.containers.table.status": "상태",
  "docker.containers.title": "컨테이너",
  "docker.images.delete_failed": "Docker 이미지를 삭제할 수 없습니다.",
  "docker.images.load_failed": "Docker 이미지를 조회할 수 없습니다.",
  "docker.images.open_containers": "컨테이너 열기",
  "docker.images.size": "크기",
  "docker.images.status": "상태",
  "docker.images.unused": "미사용",
  "docker.ipc.confirm.cancel": "취소",
  "docker.ipc.confirm.cleanup": "정리",
  "docker.ipc.error.prune_cache": "Docker 빌드 캐시를 정리할 수 없습니다.",
  "docker.ipc.error.volumes_in_use": "사용 중인 볼륨은 삭제 대상에서 제외됩니다.",
  "docker.overview.badge.partial": "부분",
  "docker.overview.badge.workflow": "워크플로",
  "docker.section.images": "도커 이미지",
  "docker.tab.build_cache": "빌드 캐시",
  "docker.tab.containers": "컨테이너",
  "docker.tab.images": "도커 이미지",
  "docker.tab.overview": "개요",
  "docker.tab.volumes": "볼륨",
  "docker.volumes.delete_failed": "Docker 볼륨을 삭제할 수 없습니다.",
  "docker.volumes.load_failed": "Docker 볼륨을 조회할 수 없습니다.",
  "main.docker.containers.empty": "정리할 Docker 컨테이너가 없습니다.",
  "Containers": "컨테이너",
  "Docker": "도커",
  "docker.build_cache.pruned": "Docker 빌드 캐시 정리 완료: {label}",
  "docker.containers.partial": "일부 실패: {message}",
  "docker.images.partial": "일부 실패: {message}",
} as const
