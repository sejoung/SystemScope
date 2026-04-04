import type { TranslationKey } from './en'

export const KO_MESSAGES: Record<TranslationKey, string> = {
  "disk.tab.overview": "개요",
  "dashboard.page.description":
    "실시간 시스템 사용량을 확인하고, 알림을 검토한 뒤 스토리지나 프로세스 상세 화면으로 바로 이동할 수 있습니다.",
  "settings.alerts.storage": "스토리지",
  "common.docker": "도커",
  "docker.page.title": "도커·컨테이너",
  "docker.page.description":
    "Docker 리소스를 정리하기 전에 컨테이너, 이미지, 볼륨, 빌드 캐시 사용량을 먼저 확인합니다.",
  "process.page.title": "활동",
  "nav.devtools": "개발 도구",
  "Review development toolchain cleanup opportunities, workspace growth, and port conflicts from one place.":
    "개발 툴체인 정리 후보, 작업공간 증가량, 포트 충돌을 한 곳에서 확인합니다.",
  "Review development toolchain cleanup opportunities, workspace growth, Docker runtime status, and port conflicts from one place.":
    "개발 툴체인 정리 후보, 작업공간 증가량, Docker 런타임 상태, 포트 충돌을 한 곳에서 확인합니다.",
  "See common development ports in use, kill the owner quickly, or jump into the raw port inspector when you need more detail.":
    "자주 쓰는 개발 포트 점유 상태를 보고, 점유 프로세스를 바로 종료하거나 더 자세한 포트 검사 화면으로 이동할 수 있습니다.",
  "process.page.description":
    "실행 중인 프로세스를 찾고, 포트를 확인하고, 특정 연결 상태를 시간에 따라 감시할 수 있습니다.",
  "process.page.tab.processes_help":
    "Processes 탭은 전체 CPU와 메모리 사용량을 보여줘서 무거운 작업을 먼저 찾는 데 적합합니다.",
  "process.page.tab.ports_help":
    "Ports 탭은 현재 열려 있는 포트와 활성 원격 연결을 일회성으로 점검할 때 적합합니다.",
  "process.page.tab.watch_help":
    "Watch 탭은 특정 포트나 IP 패턴을 계속 추적하면서 연결 변화 이력을 기록합니다.",
  "nav.applications": "앱",
  "settings.page.title": "환경설정",
  "settings.page.description":
    "알림, 테마, 언어, 스냅샷 동작을 한 곳에서 조정합니다.",
  "timeline.chart.disk": "디스크",
  "disk.page.description":
    "폴더를 스캔하고 대용량 파일과 정리 후보를 검토한 뒤 삭제 여부를 결정할 수 있습니다.",
  "apps.tab.installed": "설치됨",
  "apps.tab.leftover": "잔여 데이터",
  "apps.tab.registry": "레지스트리 정리",
  "settings.section.appearance": "화면",
  "timeline.events.filter.alert": "알림",
  "settings.alerts.description":
    "warning 값은 critical 값보다 낮게 유지하세요. 보통 75% / 85%부터 시작하면 무난합니다.",
  "settings.section.snapshots": "스냅샷",
  "settings.section.app_data": "앱 데이터",
  "settings.section.logs": "로그",
  "settings.section.about": "정보",
  "settings.section.language": "언어",
  "settings.language.english": "영어",
  "settings.language.korean": "한국어",
  "settings.theme.dark": "다크",
  "settings.theme.light": "라이트",
  "settings.badge.edited": "수정됨",
  "settings.note.save_required": "모두 저장 후 반영",
  "common.open": "열기",
  "common.copy": "복사",
  "common.copied": "복사됨",
  "common.copy_failed": "클립보드에 복사할 수 없습니다.",
  "common.show_full": "전체 보기",
  "common.show_less": "접기",
  "apps.action.refresh": "새로고침",
  "common.refresh_all": "전체 새로고침",
  "devtools.rescan": "다시 스캔",
  "devtools.scan": "스캔",
  "main.process.confirm.cancel": "취소",
  "docker.ipc.confirm.delete": "삭제",
  "common.delete_selected": "선택 삭제",
  "common.remove": "제거",
  "docker.containers.remove_selected": "선택 제거",
  "docker.ipc.confirm.stop": "중지",
  "common.pause": "일시중지",
  "common.resume": "재개",
  "disk.scan.browse_folder": "폴더 선택",
  "disk.quick_cleanup.scan_action": "빠른 스캔",
  "disk.section.quick_cleanup": "빠른 정리",
  "disk.section.file_cleanup": "파일 정리",
  "disk.file_insights.title": "파일 인사이트",
  "disk.section.folder_map": "폴더 맵",
  "disk.section.recent_growth": "최근 증가",
  "disk.section.storage_growth": "스토리지 증가",
  "disk.section.home_storage": "홈 스토리지",
  "monitoring.live_usage.title": "실시간 사용량",
  "process.top_resources.title": "상위 리소스 사용 프로세스",
  "process.table.title": "전체 프로세스 ({count})",
  "process.port_finder.title": "포트 찾기",
  "process.port_watch.title": "포트 감시",
  "disk.quick_cleanup.category.containers": "컨테이너",
  "docker.volumes.title": "볼륨",
  "docker.overview.card.build_cache": "빌드 캐시",
  "docker.images.title": "도커 이미지",
  "docker.section.overview": "도커 개요",
  "docker.section.containers": "도커 컨테이너",
  "docker.section.volumes": "도커 볼륨",
  "docker.section.build_cache": "도커 빌드 캐시",
  "devtools.docker.runtime_title": "도커 런타임",
  "devtools.docker.runtime_description":
    "전체 Docker 작업 화면을 열기 전에 Docker 사용 가능 여부와 정리 대기 중인 컨테이너 리소스를 빠르게 확인합니다.",
  "devtools.workspace.environment_title": "워크스페이스 환경",
  "devtools.workspace.environment_description":
    "추적 중인 워크스페이스 전반의 스택 신호, 환경 파일, 빌드 산출물, Git 상태, 활성 개발 서버를 확인합니다.",
  "devtools.workspace.stacks": "스택",
  "devtools.workspace.manifests": "매니페스트",
  "devtools.workspace.env_file": "환경 파일",
  "devtools.workspace.typescript_config": "TypeScript 설정",
  "devtools.workspace.docker_config": "Docker 설정",
  "devtools.workspace.active_servers": "활성 서버",
  "devtools.workspace.build_artifacts": "빌드 산출물",
  "devtools.workspace.artifact": "산출물",
  "devtools.workspace.dev_server_ports": "개발 서버 포트",
  "devtools.workspace.dependency_tooling": "의존성 도구",
  "devtools.runtime.title": "런타임 서비스",
  "devtools.runtime.description":
    "현재 listening port를 기준으로 활성 개발 서버, 애플리케이션 런타임, 데이터 서비스를 감지합니다.",
  "common.yes": "예",
  "common.no": "아니오",
  "devtools.docker.open": "도커 열기",
  "devtools.docker.stopped": "중지됨",
  "devtools.docker.unused_images": "미사용 이미지",
  "devtools.docker.summary_unavailable": "지금은 Docker 요약을 불러올 수 없습니다.",
  "disk.common.loading": "로딩 중...",
  "monitoring.loading": "데이터 로딩 중...",
  "settings.status.saving": "저장 중...",
  "settings.status.saved": "저장됨",
  "settings.status.unsaved_changes": "저장되지 않은 변경사항",
  "settings.status.all_changes_saved": "모든 변경사항 저장됨",
  "settings.save.save_all": "모두 저장",
  "window.unsaved.discard": "변경사항 버리기",
  "window.unsaved.title": "저장되지 않은 설정",
  "main.apps.confirm.move_title": "앱을 휴지통으로 이동",
  "main.apps.confirm.uninstall_title": "앱 제거",
  "shutdown.starting": "SystemScope를 종료하는 중",
  "app.error_boundary.title": "페이지 렌더링 실패",
  "app.error_boundary.message":
    "현재 페이지를 렌더링하지 못했습니다. 다른 메뉴로 이동한 뒤 다시 시도해주세요.",
  "window.unsaved.message":
    "저장하지 않은 설정 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?",
  "settings.theme.description":
    "앱 전체 색상 테마를 선택합니다.",
  "settings.language.description":
    "앱 언어를 변경합니다. 저장 후 대부분의 UI 문구가 즉시 반영됩니다.",
  "settings.snapshots.description":
    "Growth View에서 폴더 크기 변화를 추적하기 위한 스냅샷 주기입니다.",
  "settings.snapshots.current":
    "현재: {interval}분 간격 / 최대 보관: 168개 (약 {days}일분)",
  "settings.snapshots.guidance":
    "간격이 짧을수록 변화를 더 빨리 포착하지만 기록이 더 빨리 순환합니다. 간격이 길수록 더 넓은 기간을 적은 포인트로 보관합니다.",
  "settings.app_data.description":
    "설정, 스냅샷, 로그 등 앱 데이터가 저장되는 경로입니다.",
  "settings.logs.description":
    "시스템 로그와 사용자 액세스 로그는 서로 다른 폴더에 날짜별 파일로 저장되며 최근 10일치만 유지됩니다.",
  "settings.about.description":
    "현재 앱 버전과 개발자 정보를 전용 창에서 확인합니다.",
  "about.developer": "개발자",
  "settings.about.open_window": "정보 창 열기",
  "main.app.error.open_about": "정보 창을 열 수 없습니다.",
  "settings.footer.saved": "모든 변경사항이 저장되었습니다.",
  "settings.footer.unsaved": "저장하지 않은 변경사항이 있습니다.",
  "settings.footer.current_saved":
    "현재 표시 중인 설정은 저장된 상태입니다.",
  "Theme, language, alert thresholds, and snapshot interval are saved together.":
    "테마, 언어, 알림 임계치, 스냅샷 주기를 함께 저장합니다",
  "settings.app_data.config":
    "config.json — 알림 임계치, 테마 설정",
  "settings.app_data.window_state":
    "window-state.json — 창 크기/위치",
  "settings.app_data.snapshots":
    "snapshots/growth.json — 폴더 크기 스냅샷 (Growth View용)",
  "settings.logs.system_path": "시스템 로그 폴더",
  "settings.logs.access_path": "액세스 로그 폴더",
  "settings.logs.system_filename":
    "시스템 로그 파일명 — systemscope-YYYY-MM-DD.log",
  "settings.logs.access_filename":
    "액세스 로그 파일명 — systemscope-access-YYYY-MM-DD.log",
  "settings.logs.retention": "보관 기간 — 최근 10일",
  "disk.home_storage.disk_capacity": "디스크 용량",
  "timeline.events.filter.system": "시스템",
  "disk.home_storage.available": "여유 공간",
  "disk.home_storage.used_percent": "{percent}% 사용 중",
  "disk.home_storage.your_folders": "사용자 폴더",
  "disk.home_storage.total": "총합: {value}",
  "disk.home_storage.loading":
    "폴더 크기 분석 중... (첫 실행 시 수 초 소요)",
  "disk.home_storage.load_failed":
    "홈 스토리지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
  "devtools.scanning": "스캔 중...",
  "common.analyzing": "분석 중...",
  "common.analyze": "분석",
  "disk.storage_growth.loading":
    "홈 디렉토리 성장 추세 분석 중...",
  "disk.storage_growth.description":
    "홈 디렉토리에서 최근 급격히 커진 폴더를 분석합니다",
  "disk.storage_growth.no_changes":
    "최근 {period} 동안 변경이 감지되지 않았습니다.",
  "disk.storage_growth.snapshots_hint":
    "스냅샷이 쌓이면 시간대별 증감을 비교할 수 있습니다. (1시간 간격으로 자동 기록)",
  "disk.storage_growth.added": "추가됨",
  "disk.storage_growth.files": "파일",
  "disk.storage_growth.period": "기간",
  "disk.storage_growth.top": "가장 빠르게 증가한 TOP {count}",
  "disk.storage_growth.all_folders": "전체 폴더",
  "disk.error.recent_growth_failed": "최근 변경 분석에 실패했습니다.",
  "disk.recent_growth.empty":
    "최근 {days}일 내 급격히 커진 폴더가 없습니다",
  "disk.recent_growth.files": "{count}개 파일",
  "disk.recent_growth.day_1": "1일",
  "disk.recent_growth.day_3": "3일",
  "disk.recent_growth.day_7": "7일",
  "disk.recent_growth.day_14": "14일",
  "disk.recent_growth.day_30": "30일",
  "disk.quick_cleanup.badge": "정리 가능 {size}",
  "disk.quick_cleanup.description":
    "캐시, 로그, 다운로드 등 주요 폴더의 용량을 빠르게 확인합니다",
  "disk.quick_cleanup.scan_failed":
    "빠른 정리 후보 탐색에 실패했습니다.",
  "disk.quick_cleanup.empty":
    "빠른 정리 후보가 발견되지 않았습니다.",
  "Cache folders are usually safer to review first. App data, containers, and SDK folders often need manual verification before cleanup.":
    "캐시 폴더부터 검토하는 편이 일반적으로 더 안전합니다. 앱 데이터, 컨테이너, SDK 폴더는 정리 전에 수동 확인이 필요할 수 있습니다.",
  "disk.quick_cleanup.safety.review_first": "먼저 검토",
  "disk.quick_cleanup.safety.use_tool": "도구 정리 권장",
  "disk.quick_cleanup.safety.generally_safe": "비교적 안전",
  "disk.quick_cleanup.safety.review_first_note":
    "대용량 앱 데이터나 컨테이너 폴더는 무작정 제거하면 환경이 깨질 수 있습니다.",
  "disk.quick_cleanup.safety.tool_cleanup_note":
    "파일을 직접 지우기 전에 패키지 매니저 정리 명령을 우선 사용하는 편이 좋습니다.",
  "disk.quick_cleanup.safety.generally_safe_note":
    "대체로 캐시나 임시 데이터이지만, 삭제 전에는 폴더 내용을 한 번 확인하세요.",
  "disk.quick_cleanup.cleanable": "정리 가능",
  "disk.quick_cleanup.cleanable_label": "정리 가능",
  "disk.quick_cleanup.open_title": "Finder / Explorer에서 열기",
  "disk.quick_cleanup.scan_title": "이 폴더 스캔",
  "timeline.chart.cpu": "CPU",
  "timeline.chart.gpu": "GPU",
  "monitoring.disk.title": "디스크 I/O",
  "timeline.chart.network": "네트워크",
  "timeline.chart.memory": "메모리",
  "monitoring.cpu.usage": "사용량",
  "monitoring.memory.pressure": "압박도",
  "monitoring.memory.real_pressure": "실제 메모리 압박도",
  "monitoring.memory.used": "사용 중",
  "docker.build_cache.active": "활성",
  "monitoring.memory.cached": "캐시됨",
  "disk.quick_cleanup.total": "총합",
  "monitoring.memory.swap": "스왑",
  "monitoring.cpu.cores": "코어 ({count}) @ {speed} GHz",
  "monitoring.cpu.more_cores": "+추가 코어 {count}개",
  "monitoring.cpu.avg_core": "평균 코어",
  "monitoring.cpu.peak_core": "최대 코어",
  "monitoring.gpu.missing": "GPU를 감지할 수 없습니다",
  "monitoring.gpu.apple_silicon":
    "Apple Silicon은 CPU와 통합 메모리(Unified Memory)를 공유하여 별도 GPU 사용률 모니터링이 제공되지 않습니다.",
  "monitoring.gpu.virtual_adapter":
    "Windows가 가상 디스플레이 어댑터를 보고하고 있어 GPU 사용률 메트릭을 가져올 수 없습니다.",
  "monitoring.gpu.metrics_unavailable":
    "GPU는 감지되었지만 운영체제가 사용률 또는 VRAM 메트릭을 제공하지 않았습니다.",
  "monitoring.gpu.utilization": "활용률",
  "monitoring.gpu.vram": "VRAM",
  "monitoring.gpu.memory_total": "총 메모리",
  "monitoring.gpu.temperature": "온도",
  "monitoring.disk.read_iops": "읽기 IOPS",
  "monitoring.disk.write_iops": "쓰기 IOPS",
  "monitoring.disk.total_iops": "총 IOPS",
  "monitoring.disk.busy": "바쁨",
  "monitoring.disk.busy_percent": "바쁨 {value}%",
  "monitoring.disk.total_iops_value": "{value} IOPS",
  "monitoring.disk.unavailable":
    "이 시스템에서는 디스크 I/O 모니터링을 사용할 수 없습니다.",
  "monitoring.network.download": "다운로드 속도",
  "monitoring.network.upload": "업로드 속도",
  "monitoring.network.total_download": "총 다운로드",
  "monitoring.network.total_upload": "총 업로드",
  "monitoring.network.unavailable": "활성 네트워크 인터페이스 없음",
  "monitoring.collecting": "데이터 수집 중...",
  "dashboard.collecting": "시스템 정보를 수집하고 있습니다...",
  "common.clear_search": "검색 초기화",
  "about.subtitle":
    "개발자를 위한 실시간 시스템 인사이트",
  "about.homepage": "홈페이지",
  "about.github": "GitHub",
  "settings.section.updates": "업데이트",
  "settings.updates.new_version_available":
    "새 버전 v{version}이 있습니다.",
  "settings.updates.download_hint":
    "수동 업데이트를 위해 GitHub 최신 릴리즈를 브라우저에서 엽니다.",
  "Check for a newer version and open the official download page in your browser.":
    "새 버전을 확인하고 브라우저에서 공식 다운로드 페이지를 엽니다.",
  "settings.updates.current_version": "현재 버전",
  "settings.updates.latest_version": "최신 버전",
  "settings.updates.last_checked": "마지막 확인",
  "settings.updates.not_checked": "아직 확인하지 않음",
  "settings.updates.up_to_date": "이미 최신 버전을 사용 중입니다.",
  "settings.updates.no_check_yet": "아직 업데이트 확인을 실행하지 않았습니다.",
  "settings.updates.checking": "확인 중...",
  "settings.updates.check": "업데이트 확인",
  "Release Notes": "릴리즈 노트",
  "common.download": "다운로드",
  "cleanup.inbox.dismiss": "닫기",
  "dashboard.view_details": "자세히 보기",
  "settings.updates.error.check_failed":
    "지금은 업데이트를 확인할 수 없습니다.",
  "settings.updates.error.open_download":
    "릴리즈 다운로드 페이지를 열 수 없습니다.",
  "about.close": "닫기",
  "alerts.severity.critical": "심각",
  "alerts.severity.warning": "경고",
  "process.table.loading": "프로세스 데이터 로딩 중...",
  "process.top_resources.gpu_unavailable":
    "통합 메모리 환경에서는 GPU 모니터링을 제공할 수 없습니다",
  "nav.cleanup": "정리",
  "disk.scan.failed": "스캔 실패",
  "disk.scan.start_failed": "폴더 스캔을 시작하지 못했습니다.",
  "disk.scan.in_progress":
    "스캔이 진행 중입니다. 완료 후 다시 시도해주세요.",
  "disk.scan.refreshing_after_delete":
    "삭제 후 스캔 결과를 새로고침하는 중...",
  "disk.scan.refresh_failed":
    "삭제 후 스캔 결과를 새로고침하지 못했습니다.",
  "disk.scan.refresh_failed_short": "새로고침 실패",
  "disk.scan.preparing": "스캔 준비 중...",
  "Scan cancelled": "스캔이 취소되었습니다.",
  "disk.scan.cancelled": "스캔이 취소되었습니다.",
  "disk.scan.cancelled_detail":
    "폴더 스캔이 취소되었습니다. 같은 폴더를 다시 선택하면 처음부터 다시 시작할 수 있습니다.",
  "disk.scan.status_running": "진행 중",
  "disk.scan.status_complete": "완료",
  "disk.scan.status_cancelled": "취소됨",
  "disk.scan.scope_empty":
    "한 번에 하나의 폴더만 스캔합니다. 선택한 경로와 그 하위 폴더만 분석합니다.",
  "disk.scan.scope_selected":
    "현재 스캔은 선택한 폴더와 그 안의 모든 파일 및 하위 폴더를 포함합니다. 폴더가 클수록 더 오래 걸릴 수 있습니다.",
  "disk.scan.empty":
    "폴더를 선택하면 용량 분포, 대용량 파일, 중복 파일을 바로 분석합니다.",
  "disk.cleanup.empty_title":
    "폴더를 스캔하면 대용량 파일, 오래된 파일, 중복 파일을 정리할 수 있습니다.",
  "disk.cleanup.empty_detail":
    "Scan 탭에서 폴더를 스캔하거나, 위 Quick Cleanup에서 폴더를 선택하세요.",
  "process.tab.processes": "프로세스",
  "docker.containers.table.ports": "포트",
  "process.tab.watch": "감시",
  "disk.file_insights.name": "이름",
  "process.port_finder.action": "작업",
  "process.table.search_placeholder": "이름, PID, 명령어 검색...",
  "main.process.error.kill_failed": "프로세스를 종료할 수 없습니다.",
  "process.port_finder.kill_sent":
    '"{name}" (PID {pid}) 종료 요청을 보냈습니다.',
  "process.table.helper":
    "프로세스는 CPU 사용량 순으로 먼저 정렬됩니다. 종료 요청을 보내면 실행 중인 작업이 즉시 멈출 수 있으니, 명령어를 확인한 뒤 진행하세요.",
  "monitoring.cpu.status.high": "높음",
  "process.table.cpu_medium": "보통",
  "monitoring.cpu.status.normal": "정상",
  "main.process.confirm.kill": "종료",
  "process.port_finder.empty_search": '"{query}" 검색 결과 없음',
  "process.table.empty":
    "현재 표시할 실행 중 프로세스가 없습니다.",
  "process.port_finder.search_all_v2": "포트, 주소, 프로세스...",
  "process.port_finder.search_local_v2": "로컬 포트, 주소, 프로세스...",
  "process.port_finder.search_remote_v2": "원격 포트, 주소, 프로세스...",
  "process.port_finder.scan": "포트 스캔",
  "process.port_finder.description":
    "현재 사용 중인 네트워크 포트와 점유 프로세스를 조회합니다",
  "process.port_finder.helper":
    "Port Finder는 일회성 점검용입니다. 여기서 PID를 종료하면 해당 포트를 점유한 프로세스가 종료되어 활성 연결이 즉시 끊길 수 있습니다.",
  "process.port_watch.filter.all": "전체 ({count})",
  "process.port_finder.filter.listening": "수신 대기 ({count})",
  "process.port_finder.filter.established": "연결됨 ({count})",
  "process.port_finder.filter.other": "기타 ({count})",
  "process.port_finder.empty_state": "해당 상태의 포트가 없습니다",
  "process.port_watch.proto": "프로토콜",
  "process.port_finder.local_port": "로컬 포트",
  "process.port_watch.process": "프로세스",
  "process.port_watch.state": "상태",
  "process.port_watch.remote": "원격",
  "process.port_finder.kill": "PID 종료",
  "process.port_watch.description":
    "포트 번호, IP 주소, 또는 IP:Port를 등록하면 실시간으로 연결 상태를 감시합니다.",
  "process.port_watch.placeholder_local": "로컬 포트 또는 주소",
  "process.port_watch.placeholder_remote": "원격 포트 또는 주소",
  "process.port_watch.placeholder_all": "포트, IP 또는 IP:Port",
  "process.port_watch.add": "감시 추가",
  "process.port_watch.monitoring": "감시 중",
  "process.port_watch.list": "감시 목록",
  "process.port_watch.details": "상세",
  "process.port_watch.hide": "숨기기",
  "process.port_watch.filtered_listening": "Filtered: Listening ({count})",
  "process.port_watch.filtered_established": "Filtered: Established ({count})",
  "process.port_watch.filtered_other": "Filtered: Other ({count})",
  "process.port_watch.history": "기록",
  "common.clear": "지우기",
  "process.port_watch.connected_label": "연결됨",
  "process.port_watch.disconnected_label": "연결 해제됨",
  "process.port_watch.filter.connected": "연결됨 ({count})",
  "process.port_watch.filter.disconnected": "연결 해제됨 ({count})",
  "process.port_watch.history_summary":
    "기록된 이벤트: 연결됨 {connected} / 연결 해제됨 {disconnected}",
  "컨테이너 보기": "Containers 보기",
  running: "실행 중",
  stopped: "중지됨",
  "docker.images.in_use": "사용 중",
  unused: "미사용",
  "docker.images.scan_action": "이미지 스캔",
  "docker.build_cache.prune": "캐시 정리",
  "docker.build_cache.entries": "캐시 항목",
  "docker.build_cache.total_size": "총 크기",
  "docker.build_cache.reclaimable": "회수 가능",
  "docker.build_cache.retry_refresh": "Refresh로 다시 시도하세요.",
  "apps.page.title": "앱",
  "apps.action.open_system_settings": "시스템 설정 열기",
  "common.search": "검색",
  "apps.platform.all": "전체 플랫폼",
  "apps.confidence.all": "전체 신뢰도",
  "apps.search.installed_placeholder": "설치 앱 검색",
  "apps.search.leftover_placeholder": "잔여 데이터 검색",
  "apps.search.registry_placeholder": "레지스트리 정리 항목 검색",
  "apps.description.registry":
    "Windows 전용입니다. 이 탭은 설치 경로와 언인스톨러가 모두 더 이상 유효하지 않은 uninstall 레지스트리 항목만 보여줍니다.",
  "apps.error.load_registry":
    "남아 있는 uninstall 레지스트리 항목을 불러오지 못했습니다.",
  "apps.error.remove_registry":
    "남아 있는 uninstall 레지스트리 항목을 제거하지 못했습니다.",
  "apps.toast.registry_all":
    "uninstall 레지스트리 항목 {count}개를 제거했습니다.",
  "apps.toast.registry_partial":
    "uninstall 레지스트리 항목 {deletedCount}개를 제거했고, {failedCount}개는 실패했습니다.",
  "apps.loading.registry":
    "남아 있는 uninstall 레지스트리 항목을 불러오는 중...",
  "apps.empty.registry":
    "정리할 uninstall 레지스트리 잔여 항목이 발견되지 않았습니다.",
  "apps.empty.registry_detail":
    "Windows에 정리할 오래된 uninstall 레지스트리 항목이 남아 있지 않다면 정상입니다.",
  "apps.helper.registry":
    "설치 경로와 언인스톨러가 모두 더 이상 유효하지 않은 uninstall 레지스트리 항목입니다. 삭제해도 남은 제거 등록 정보만 정리됩니다.",
  "apps.action.remove_selected_registry": "선택한 레지스트리 항목 제거",
  "apps.count.registry_summary": "레지스트리 항목 {count}개",
  "apps.registry.path": "레지스트리 경로",
  "apps.registry.install_missing": "설치 경로 없음",
  "apps.registry.uninstaller_missing": "언인스톨러 없음",
  "apps.registry.install_unavailable": "설치 경로 정보 없음",
  "apps.registry.uninstall_unavailable": "언인스톨 명령 정보 없음",
  "apps.related.title": "관련 데이터",
  "apps.action.hide_data": "데이터 숨기기",
  "main.apps.confirm.action_move_to_trash": "휴지통으로 이동",
  "main.apps.confirm.action_uninstall": "제거",
  "apps.action.working": "작업 중...",
  "main.settings.error.invalid_value": "유효하지 않은 설정 값입니다.",
  "main.settings.error.save_failed": "설정 저장에 실패했습니다.",
  "settings.validation.warning_before_critical":
    "{label}: warning 값은 critical 값보다 낮아야 합니다.",
  "settings.validation.resolve_before_save":
    "검증 오류를 먼저 해결한 뒤 저장하세요.",
  "disk.error.invalid_path": "유효하지 않은 경로입니다.",
  "main.settings.error.permission_denied":
    "허용되지 않은 경로입니다.",
  "main.settings.error.path_missing": "경로가 존재하지 않습니다.",
  "main.settings.error.open_folder": "폴더를 열 수 없습니다.",
  "disk.error.no_active_window": "활성 창을 찾을 수 없습니다.",
  "disk.error.invalid_limit": "유효하지 않은 limit 값입니다.",
  "main.process.error.fetch_processes": "프로세스 정보를 가져올 수 없습니다.",
  "main.process.error.fetch_ports": "포트 정보를 가져올 수 없습니다.",
  "main.process.error.invalid_pid": "유효하지 않은 PID입니다.",
  "main.process.error.not_found": "프로세스를 찾을 수 없습니다.",
  "main.process.error.protected":
    "앱 자신이나 보호된 프로세스는 종료할 수 없습니다.",
  "main.process.confirm.warning": "저장되지 않은 작업이 손실될 수 있습니다.",
  "main.process.confirm.title": "프로세스 종료",
  "ports.watch.validation_error":
    "유효한 포트, IP 또는 IP:Port 형식을 입력하세요.",
  "ports.watch.error.refresh":
    "포트 감시 상태를 새로고침하지 못했습니다.",
  "main.process.confirm.message": '"{name}" 프로세스를 종료하시겠습니까?',
  "main.process.error.changed":
    "프로세스 상태가 변경되어 종료를 중단했습니다.",
  "apps.error.load_installed":
    "설치 앱 목록을 불러오지 못했습니다.",
  "apps.error.invalid_app_id": "유효하지 않은 앱 ID입니다.",
  "main.apps.error.no_install_path": "설치 위치를 열지 못했습니다.",
  "main.app.error.open_homepage": "홈페이지를 열 수 없습니다.",
  "apps.error.open_system_settings":
    "시스템 제거 설정을 열지 못했습니다.",
  "apps.error.load_related": "관련 데이터 목록을 불러오지 못했습니다.",
  "apps.error.load_leftover": "잔여 앱 데이터를 불러오지 못했습니다.",
  "apps.error.invalid_item_ids": "유효하지 않은 항목 ID 목록입니다.",
  "apps.error.remove_leftover":
    "잔여 앱 데이터를 휴지통으로 이동하지 못했습니다.",
  "main.apps.error.not_found":
    "설치 앱 정보를 찾을 수 없습니다.",
  "main.apps.error.protected": "보호된 항목은 제거할 수 없습니다.",
  "main.apps.confirm.move_detail":
    "앱 번들을 휴지통으로 이동합니다.",
  "main.apps.confirm.uninstall_detail":
    "설치된 제거 프로그램을 실행합니다. 진행은 외부 제거기에서 계속됩니다.",
  "main.apps.message.opened_system_settings": "시스템 제거 설정을 열었습니다.",
  "main.apps.confirm.related_detail":
    "선택한 관련 데이터 경로도 함께 휴지통으로 이동합니다.",
  "main.apps.confirm.message": '"{name}"을(를) {action}하시겠습니까?',
  "apps.error.uninstall_start": "앱 제거를 시작하지 못했습니다.",
  "main.trash.error.no_files": "삭제할 수 있는 파일이 없습니다.",
  "main.trash.dialog.detail":
    "{count}개 항목 ({size})을 휴지통으로 이동하시겠습니까?\n\n{fileList}\n\n휴지통에서 복구할 수 있습니다.",
  "window.unsaved.quit_detail": "저장하지 않고 앱을 종료하시겠습니까?",
  "window.unsaved.close_detail":
    "저장하지 않고 창을 닫으면 변경사항이 사라집니다.",
  "disk.scan.folders": "폴더",
  "disk.scan.duration": "소요 시간",
  "disk.file_insights.tab.types": "파일 형식",
  "disk.file_insights.tab.largest": "대용량 파일",
  "disk.file_insights.tab.old": "오래된 파일",
  "disk.file_insights.tab.duplicates": "중복 파일",
  "disk.file_insights.delete_info_missing":
    "삭제할 항목 정보를 찾지 못했습니다.",
  "disk.file_insights.trash_success":
    "{count}개 항목 ({size})을 휴지통으로 이동했습니다",
  "docker.volumes.partial": "일부 실패: {message}",
  "disk.file_insights.delete_failed": "삭제 실패: {message}",
  "disk.file_insights.unknown_error": "알 수 없는 오류",
  "Failed to move items to the trash.": "휴지통 이동에 실패했습니다.",
  "disk.file_insights.delete_large": "대용량 파일 삭제",
  "disk.file_insights.delete_old": "오래된 파일 삭제",
  "disk.file_insights.delete_duplicates": "중복 파일 삭제",
  "disk.file_insights.no_data": "데이터가 없습니다",
  "No large files found.": "대용량 파일이 없습니다",
  "disk.file_insights.size": "크기",
  "disk.file_insights.days_90": "90일",
  "disk.file_insights.days_180": "180일",
  "disk.file_insights.days_365": "1년",
  "disk.file_insights.days_730": "2년",
  "disk.file_insights.old_filter_full_hint": "이상 미사용 / 1MB 이상",
  "disk.file_insights.files_size": "{count} files / {size}",
  "disk.file_insights.old_empty_prompt":
    "오래된 파일을 찾으려면 Scan 버튼을 클릭하세요",
  "No old files were found for that period.":
    "해당 기간 내 오래된 파일이 없습니다",
  "disk.file_insights.last_modified": "마지막 수정",
  "disk.file_insights.find_duplicates": "중복 찾기",
  "disk.file_insights.dup_min_size_hint": "100KB 이상",
  "disk.file_insights.dup_summary": "{count} groups / {size} wasted",
  "Click Find Duplicates to search for duplicate files.":
    "중복 파일을 찾으려면 Find Duplicates 버튼을 클릭하세요",
  "disk.file_insights.dup_empty": "중복 파일을 찾지 못했습니다",
  "disk.file_insights.copies": "{count} copies",
  "disk.file_insights.keep": "보관",
  "disk.file_insights.delete_all_keep_first": "Delete all copies (keep first)",
  "common.status.started": "시작됨",
  "common.status.in_progress": "진행 중",
  "common.status.completed": "완료됨",
  "common.status.failed": "실패",
  "Quick scan started. Reviewing common cleanup locations now.":
    "빠른 스캔을 시작했습니다. 자주 정리하는 위치를 확인하는 중입니다.",
  "Quick scan completed. Review size, safety guidance, and open a folder before deleting anything.":
    "빠른 스캔이 완료되었습니다. 크기와 안전 안내를 확인한 뒤 폴더를 열어 검토하세요.",
  "Port scan started. Collecting listening and connected socket information now.":
    "포트 스캔을 시작했습니다. 리슨 중인 포트와 연결 정보를 수집하는 중입니다.",
  "Port scan completed. Filter by state or search local and remote endpoints to inspect the results.":
    "포트 스캔이 완료되었습니다. 상태 필터나 로컬/원격 검색으로 결과를 확인하세요.",
  "process.table.sort.cpu_desc": "CPU 사용량 높은 순으로 정렬됨",
  "process.table.sort.cpu_asc": "CPU 사용량 낮은 순으로 정렬됨",
  "Default order starts with CPU-heavy processes so sudden load is easier to spot.":
    "기본 순서는 CPU 사용량이 높은 프로세스를 먼저 보여줘 급격한 부하를 빨리 찾기 쉽습니다.",
  "process.table.sort.memory_desc": "메모리 사용량 높은 순으로 정렬됨",
  "process.table.sort.memory_asc": "메모리 사용량 낮은 순으로 정렬됨",
  "Memory sort helps compare which processes occupy the most space right now.":
    "메모리 정렬은 지금 가장 많은 메모리를 차지하는 프로세스를 비교할 때 유용합니다.",
  "process.table.sort.pid_desc": "PID 큰 순으로 정렬됨",
  "process.table.sort.pid_asc": "PID 작은 순으로 정렬됨",
  "PID order is useful when you already know the target process number.":
    "PID 정렬은 이미 찾는 프로세스 번호를 알고 있을 때 유용합니다.",
  "process.table.sort.name_desc": "이름 Z-A 순으로 정렬됨",
  "process.table.sort.name_asc": "이름 A-Z 순으로 정렬됨",
  "Name order is useful when you already know the process name you want to inspect.":
    "이름 정렬은 확인하려는 프로세스 이름을 이미 알고 있을 때 유용합니다.",
  "Sorted by state first, then local port":
    "상태 우선, 그다음 로컬 포트 순으로 정렬됨",
  "Default order shows listening ports before active connections so server endpoints are easier to scan.":
    "기본 순서는 listening 포트를 활성 연결보다 먼저 보여줘 서버 포트를 훑어보기 쉽습니다.",
  "Sorted by app name, A to Z so known apps are easier to find.":
    "앱 이름 A-Z 순으로 정렬해 찾는 앱을 더 빨리 찾을 수 있습니다.",
  "Loading installed apps.": "설치 앱 목록을 불러오는 중입니다.",
  "Loading leftover app data.": "잔여 앱 데이터를 불러오는 중입니다.",
  "No installed apps to display.": "표시할 설치 앱이 없습니다.",
  "You can remove installed apps directly, or expand each app to also trash related data candidates.":
    "설치된 앱을 직접 정리하거나, 앱별 관련 데이터 후보를 펼쳐 함께 휴지통으로 이동할 수 있습니다.",
  "Only the selected paths will be moved to the trash together with app removal.":
    "선택한 경로만 앱 제거와 함께 휴지통으로 이동합니다.",
  "Searching for related data candidates.": "관련 데이터 후보를 찾는 중입니다.",
  "apps.related.empty": "감지된 관련 데이터 경로가 없습니다.",
  "No leftover app data to display.": "표시할 잔여 앱 데이터가 없습니다.",
  "apps.action.move_selected_to_trash": "선택 항목을 휴지통으로 이동",
  "apps.count.apps": "{count} apps",
  "apps.count.items": "{count} items",
  "The app was removed.": "앱을 제거했습니다.",
  "apps.toast.leftover_data_all":
    "잔여 데이터 {count}개를 휴지통으로 이동했습니다.",
  "apps.toast.leftover_partial":
    "잔여 데이터 {deletedCount}개 이동, {failedCount}개 실패",
  "Unable to open the path.": "경로를 열지 못했습니다.",
  "On macOS, the app bundle is moved to the trash. On Windows, the registered uninstaller is launched. You can also select related data from the expanded section.":
    "macOS는 앱 번들을 휴지통으로 이동하고, Windows는 등록된 제거 프로그램을 실행합니다. 펼친 항목에서 관련 데이터도 함께 선택할 수 있습니다.",
  "You can clean up leftover related data even if the main app is no longer installed.":
    "앱 본체가 없어도 남아 있는 관련 데이터 후보를 따로 정리할 수 있습니다.",
  "process.port_watch.badge": "{count} watching",
  "process.port_watch.already_registered": '"{pattern}"은 이미 등록되어 있습니다.',
  "process.port_watch.connection_detected_for":
    "{pattern} 연결 감지됨 ({process})",
  "process.port_watch.connection_lost_for": "{pattern} 연결 해제됨",
  "process.port_watch.duplicate": '"{pattern}"은 이미 등록되어 있습니다.',
  "process.port_watch.connected":
    "{pattern} 연결 감지됨 ({process})",
  "process.port_watch.disconnected": "{pattern} 연결 해제됨",
  "process.port_finder.badge": "{count} listening",
  "process.port_watch.local": "로컬",
  "process.port_watch.more":
    "+{count} more (showing first {limit})",
  "process.port_watch.state_filter_title": "{label} — click to filter",
  "main.alert.error.invalid_id": "유효하지 않은 알림 ID입니다.",
  "main.alert.error.not_found": "알림을 찾을 수 없습니다.",
  "Failed to dismiss the alert.": "알림 해제에 실패했습니다.",
  "main.alert.message.cpu_usage": "CPU 사용률 {usage}%",
  "main.alert.message.disk_usage": "디스크 {mount} 사용률 {usage}%",
  "main.alert.message.memory_usage": "메모리 사용률 {usage}%",
  "main.alert.message.gpu_memory_usage": "GPU 메모리 사용률 {usage}%",
  "Invalid log payload.": "유효하지 않은 로그 payload입니다.",
  "Invalid log message.": "유효하지 않은 로그 메시지입니다.",
  "main.app.error.invalid_unsaved_payload":
    "유효하지 않은 unsaved settings payload입니다.",
  "Unable to load system information.": "시스템 정보를 가져올 수 없습니다.",
  "shutdown.cleaning_up": "백그라운드 서비스를 정리하는 중...",
  "shutdown.cancelling_jobs": "진행 중인 작업을 취소하는 중...",
  "shutdown.waiting_snapshot": "스냅샷 작업 완료 대기 중...",
  "shutdown.finishing": "종료를 마무리하는 중...",
  "growth.wait_timeout": "스냅샷 대기 시간이 초과되었습니다.",
  "disk.trash.description": "파일 삭제",
  "disk.error.trash_failed": "파일 삭제에 실패했습니다.",
  "disk.error.invalid_trash_request": "유효하지 않은 삭제 요청입니다.",
  "disk.error.invalid_job_id": "유효하지 않은 작업 ID입니다.",
  "No cancellable job was found.": "취소할 수 있는 작업을 찾을 수 없습니다.",
  "disk.scan.progress": "스캔 중: {name} ({count}개 파일)",
  "Scan was cancelled.": "스캔이 취소되었습니다.",
  "disk.scan.failed_runtime": "디스크 스캔 중 오류가 발생했습니다.",
  "Failed to find large files.": "대용량 파일 탐색에 실패했습니다.",
  "Failed to analyze file extensions.": "확장자 분석에 실패했습니다.",
  "disk.error.quick_scan_failed": "빠른 스캔에 실패했습니다.",
  "Failed to analyze user space.": "사용자 공간 분석에 실패했습니다.",
  "disk.error.invalid_days_short": "유효하지 않은 기간입니다. (1~365일)",
  "disk.error.invalid_min_size":
    "유효하지 않은 최소 크기입니다. (1KB~1GB)",
  "disk.error.invalid_growth_period": "유효하지 않은 기간입니다. (1h, 24h, 7d)",
  "disk.error.invalid_old_days": "유효하지 않은 기간입니다. (1~3650일)",
  "Items not in the current scan result cannot be deleted.":
    "현재 스캔 결과에 없는 항목은 삭제할 수 없습니다.",
  "disk.error.access_denied": "폴더에 접근할 수 없습니다.",
  "Docker volumes currently in use cannot be deleted.":
    "사용 중인 Docker 볼륨은 삭제할 수 없습니다.",
  "docker.ipc.error.no_volumes": "삭제할 Docker 볼륨이 없습니다.",
  "docker.ipc.error.no_volumes_found":
    "삭제할 Docker 볼륨을 찾을 수 없습니다.",
  "docker.ipc.confirm.volumes_title": "Docker 볼륨 삭제",
  "Prune Docker Build Cache": "Docker Build Cache 정리",
  "docker.confirm.prune_build_cache":
    "Docker build cache를 정리하시겠습니까?",
  "docker.ipc.confirm.cache_detail": "현재 회수 가능 용량: {size}",
  "docker.overview.action.prune": "정리",
  "docker.confirm.delete_images_full":
    "{count}개의 Docker 이미지를 삭제하시겠습니까?",
  "docker.confirm.delete_containers_full":
    "{count}개의 Docker 컨테이너를 삭제하시겠습니까?",
  "docker.confirm.stop_containers_full":
    "{count}개의 Docker 컨테이너를 중지하시겠습니까?",
  "docker.confirm.delete_volumes_full":
    "{count}개의 Docker 볼륨을 삭제하시겠습니까?",
  "docker.ipc.confirm.total_size": "총 크기: {size}",
  "docker.ipc.confirm.more": "- ... 외 {count}개",
  "common.refreshing": "새로고침 중...",
  "docker.containers.badge": "{count}개 컨테이너",
  "docker.containers.table.container": "컨테이너",
  "docker.containers.table.image": "이미지",
  "docker.containers.table.writable": "쓰기 가능 용량",
  "docker.containers.deleted":
    "{count}개 Docker 컨테이너를 삭제했습니다.",
  "docker.containers.stopped":
    "{count}개 Docker 컨테이너를 중지했습니다.",
  "docker.containers.stop_running": "running {count}개 중지",
  "View Images": "Images 보기",
  "docker.containers.initial": "Docker 컨테이너를 조회해보세요.",
  "docker.ipc.error.list_containers": "Docker 컨테이너를 조회할 수 없습니다.",
  "docker.ipc.error.remove_containers":
    "Docker 컨테이너를 삭제할 수 없습니다.",
  "docker.ipc.error.stop_containers": "Docker 컨테이너를 중지할 수 없습니다.",
  "Unable to connect to the Docker daemon.":
    "Docker daemon에 연결할 수 없습니다.",
  "docker.common.check_status":
    "Docker Desktop 또는 Docker Engine 상태를 확인하세요.",
  "If there are stopped containers, clean them up here first and then move to the Images tab.":
    "종료된 컨테이너가 있으면 여기서 먼저 정리한 뒤 Images 탭으로 이동하세요.",
  "Cleaning up stopped containers first can unblock image deletion in the Images tab.":
    "종료된 컨테이너를 먼저 정리하면 Images 탭에서 참조 중으로 막힌 이미지 삭제가 가능해집니다.",
  "docker.build_cache.initial": "Docker build cache를 조회해보세요.",
  "docker.ipc.error.build_cache":
    "Docker build cache를 조회할 수 없습니다.",
  "Unable to prune Docker build cache.":
    "Docker build cache를 정리할 수 없습니다.",
  "docker.build_cache.pruned_label": "Docker build cache 정리 완료: {label}",
  "No Docker build cache information is available.":
    "Docker build cache 정보가 없습니다.",
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
  "Docker is unavailable.": "Docker를 사용할 수 없습니다.",
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
  "This likely removes only settings, but you may not be able to restore them after reinstalling the app.":
    "설정값만 지워질 가능성이 높지만, 앱 재설치 후 기존 설정을 복구하지 못할 수 있습니다.",
  "This item is in a standard app data path but was classified by name only.":
    "표준 앱 데이터 경로에 있지만 이름 기반으로 분류된 항목입니다.",
  "This may include app data, downloads, or internal databases, so confirm the path before deleting it.":
    "앱 데이터, 다운로드, 내부 DB가 포함될 수 있어 삭제 전 경로 확인이 필요합니다.",
  "main.apps.leftover.mac.default_reason":
    "표준 {label} 경로에 있는 항목이지만 이름 기반 후보입니다.",
  "This is likely cache or log data, but some reusable data may be mixed in.":
    "캐시/로그 성격일 가능성이 높지만 일부 재사용 데이터가 섞여 있을 수 있습니다.",
  "This item is in a shared program data path and does not match any installed program.":
    "공용 프로그램 데이터 경로에 있고 설치된 프로그램 목록과 일치 항목이 없습니다.",
  "Shared settings or service data may still remain, so verify before deleting it.":
    "공용 설정이나 서비스 데이터가 남아 있을 수 있어 삭제 전 확인이 필요합니다.",
  "This item is in a user-local programs path but does not match any installed app.":
    "사용자 로컬 프로그램 경로에 있지만 설치 목록과 일치 항목이 없습니다.",
  "If you no longer use the app, this is likely safe to delete, but it may also belong to a portable app.":
    "앱을 더 이상 쓰지 않는다면 삭제해도 될 가능성이 높지만 휴대용 앱일 수도 있습니다.",
  "main.apps.leftover.mac.support_reason":
    "표준 {label} 경로에 있지만 설치 목록과 이름 기반으로만 비교된 항목입니다.",
  "This may be cache or settings data, but some apps may reuse it after reinstall.":
    "캐시나 설정일 수 있지만 일부 앱은 재설치 시 재사용할 데이터가 포함될 수 있습니다.",
  "main.apps.leftover.mac.container_reason":
    "표준 macOS {label} 경로에 있고 설치된 앱 번들과 일치 항목이 없습니다.",
  "If you no longer use the app, this is likely safe to remove, but login state or sandbox data may be lost.":
    "앱을 더 이상 쓰지 않는다면 지워도 될 가능성이 높지만, 로그인 상태나 샌드박스 데이터가 사라질 수 있습니다.",
  "This is a bundle ID style preference file and does not match any installed app.":
    "bundle id 형태의 환경설정 파일이며 설치된 앱과 일치 항목이 없습니다.",
  "This is a preference file, but it was inferred by name only.":
    "환경설정 파일이지만 이름 기반으로만 추정했습니다.",
  "This is not supported on the current operating system.":
    "현재 운영체제에서는 지원되지 않습니다.",
  "There is no install path that can be opened.":
    "열 수 있는 설치 경로가 없습니다.",
  "main.apps.error.no_app_path":
    "삭제할 앱 경로를 찾을 수 없습니다.",
  "main.apps.error.no_uninstall_command":
    "실행 가능한 제거 명령이 없습니다.",
  "The currently running SystemScope app cannot be removed.":
    "현재 실행 중인 SystemScope는 제거할 수 없습니다.",
  "System apps or the currently running app cannot be removed.":
    "시스템 앱 또는 현재 실행 중인 앱은 삭제할 수 없습니다.",
  "main.apps.message.with_related_all":
    "{baseMessage} 관련 데이터 {deletedCount}개도 함께 휴지통으로 이동했습니다.",
  "main.apps.message.with_related_partial":
    "{baseMessage} 관련 데이터 {deletedCount}개를 함께 이동했고 {failedCount}개는 이동하지 못했습니다.",
  "settings.snapshots.option_15m": "15분",
  "settings.snapshots.option_30m": "30분",
  "settings.snapshots.option_1h": "1시간",
  "settings.snapshots.option_2h": "2시간",
  "settings.snapshots.option_6h": "6시간",
  "settings.app_data.open_failed": "앱 데이터 폴더를 열지 못했습니다.",
  "settings.logs.open_failed": "로그 폴더를 열지 못했습니다.",
  "main.apps.message.moved_to_trash": "앱을 휴지통으로 이동했습니다.",
  "main.apps.message.started_uninstaller": "제거 프로그램을 시작했습니다.",
  "apps.description.installed":
    "macOS는 앱 번들을 휴지통으로 이동하고, Windows는 등록된 제거 프로그램을 실행합니다. 펼친 항목에서 관련 데이터도 함께 선택할 수 있습니다.",
  "apps.description.leftover":
    "앱 본체가 없어도 남아 있는 관련 데이터 후보를 따로 정리할 수 있습니다.",
  "apps.flow.installed": "1. 설치 앱 검토",
  "apps.flow.leftover": "2. 잔여 데이터 정리",
  "apps.flow.registry": "3. 오래된 레지스트리 정리",
  "apps.loading.installed": "설치 앱 목록을 불러오는 중입니다.",
  "apps.loading.leftover": "잔여 앱 데이터를 불러오는 중입니다.",
  "apps.empty.installed": "표시할 설치 앱이 없습니다.",
  "apps.empty.leftover": "표시할 잔여 앱 데이터가 없습니다.",
  "apps.sort.priority": "우선순위 정렬",
  "apps.sort.name": "이름순 정렬",
  "apps.sort.size": "용량 큰 순",
  "apps.sort.priority_detail":
    "이 화면에는 용량 정보가 없어서 높은 신뢰도 항목이 먼저 보이도록 정렬합니다.",
  "apps.sort.name_detail":
    "앱 이름 기준으로 가나다/알파벳 순 정렬합니다.",
  "apps.sort.size_detail":
    "큰 잔여 데이터부터 먼저 보여줘 정리 효과가 큰 항목을 우선 검토하기 쉽습니다.",
  "apps.sort.size_pending_detail":
    "남은 폴더 크기 계산이 끝나는 대로 용량 기준 정렬이 계속 갱신됩니다.",
  "apps.helper.installed":
    "설치된 앱을 직접 정리하거나, 앱별 관련 데이터 후보를 펼쳐 함께 휴지통으로 이동할 수 있습니다.",
  "apps.helper.leftover":
    "설치된 앱과 연결되지 않은 잔여 데이터 후보입니다. 각 카드의 근거와 위험도를 보고 직접 선택하세요.",
  "These are leftover data candidates not currently linked to an installed app. Review each card's rationale and risk before selecting it.":
    "현재 설치된 앱과 연결되지 않은 잔여 데이터 후보입니다. 각 카드의 근거와 위험도를 확인 후 선택하세요.",
  "apps.status.leftover_sizes_loading":
    "폴더 크기 계산 중: {ready}/{total}개 준비됨, {remaining}개 남음",
  "apps.status.leftover_sizes_ready":
    "전체 {count}개 항목의 폴더 크기 계산이 완료되었습니다",
  "apps.danger.installed":
    "앱 제거는 선택한 앱에 즉시 영향을 줍니다. Windows에서는 앱 자체 제거 프로그램이 실행될 수 있고, 선택한 관련 데이터도 함께 정리될 수 있습니다.",
  "apps.danger.leftover":
    "잔여 데이터 정리는 선택한 폴더를 휴지통으로 이동합니다. 아직 필요할 수 있는 항목은 경로와 위험 설명을 확인한 뒤 정리하세요.",
  "apps.danger.registry":
    "레지스트리 정리는 오래된 제거 항목만 삭제합니다. 설치 경로와 제거 명령을 확인한 뒤 마지막 단계에서 진행하세요.",
  "apps.related.description":
    "선택한 경로만 앱 제거와 함께 휴지통으로 이동합니다.",
  "apps.selection.leftover_summary":
    "선택 항목: 높음 {high} / 중간 {medium} / 낮음 {low}",
  "apps.selection.registry_summary": "선택한 오래된 항목: {count}",
  "apps.registry.warning":
    "레지스트리 정리는 오래된 제거 항목만 지웁니다. 마지막 정리 단계에서 사용하는 편이 좋습니다.",
  "apps.related.loading": "관련 데이터 후보를 찾는 중입니다.",
  "process.port_watch.state.listening": "수신 대기",
  "process.port_watch.state.established": "연결됨",
  "process.port_watch.state.other": "기타",
  "main.apps.error.unsupported_os":
    "현재 운영체제에서는 지원되지 않습니다.",
  "main.apps.protected.current_app":
    "현재 실행 중인 SystemScope는 제거할 수 없습니다.",
  "main.apps.protected.system_app":
    "시스템 앱 또는 현재 실행 중인 앱은 삭제할 수 없습니다.",
  "main.apps.leftover.mac.container_risk":
    "앱을 더 이상 쓰지 않는다면 지워도 될 가능성이 높지만, 로그인 상태나 샌드박스 데이터가 사라질 수 있습니다.",
  "main.apps.leftover.mac.pref_bundle_reason":
    "bundle id 형태의 환경설정 파일이며 설치된 앱과 일치 항목이 없습니다.",
  "main.apps.leftover.mac.pref_name_reason":
    "환경설정 파일이지만 이름 기반으로만 추정했습니다.",
  "main.apps.leftover.mac.pref_risk":
    "설정값만 지워질 가능성이 높지만, 앱 재설치 후 기존 설정을 복구하지 못할 수 있습니다.",
  "main.apps.leftover.mac.support_risk":
    "앱 데이터, 다운로드, 내부 DB가 포함될 수 있어 삭제 전 경로 확인이 필요합니다.",
  "main.apps.leftover.mac.default_risk":
    "캐시/로그 성격일 가능성이 높지만 일부 재사용 데이터가 섞여 있을 수 있습니다.",
  "main.apps.leftover.win.programdata_reason":
    "공용 프로그램 데이터 경로에 있고 설치된 프로그램 목록과 일치 항목이 없습니다.",
  "main.apps.leftover.win.programdata_risk":
    "공용 설정이나 서비스 데이터가 남아 있을 수 있어 삭제 전 확인이 필요합니다.",
  "main.apps.leftover.win.local_programs_reason":
    "사용자 로컬 프로그램 경로에 있지만 설치 목록과 일치 항목이 없습니다.",
  "main.apps.leftover.win.local_programs_risk":
    "앱을 더 이상 쓰지 않는다면 삭제해도 될 가능성이 높지만 휴대용 앱일 수도 있습니다.",
  "main.apps.leftover.win.default_reason":
    "표준 {label} 경로에 있지만 설치 목록과 이름 기반으로만 비교된 항목입니다.",
  "main.apps.leftover.win.default_risk":
    "캐시나 설정일 수 있지만 일부 앱은 재설치 시 재사용할 데이터가 포함될 수 있습니다.",
  "apps.badge.protected": "보호됨",
  "apps.table.version": "버전",
  "apps.table.publisher": "배포자",
  "apps.table.platform": "플랫폼",
  "apps.table.location": "위치",
  "apps.table.actions": "동작",
  "common.selected": "{count}개 선택됨",
  "apps.count.installed_summary": "설치 앱 {count}개",
  "apps.count.leftover_summary": "잔여 항목 {count}개",
  "apps.reason.why": "근거:",
  "apps.reason.risk": "위험:",
  "apps.confidence.high": "높은 신뢰도",
  "apps.confidence.medium": "중간 신뢰도",
  "apps.confidence.low": "낮은 신뢰도",
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
  workflow: "워크플로",
  partial: "일부",
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
  "settings.alerts.warning": "경고 (%)",
  "settings.alerts.critical": "위험 (%)",
  "settings.alerts.preset.conservative": "보수적",
  "settings.alerts.preset.balanced": "균형",
  "settings.alerts.preset.aggressive": "공격적",
  "common.no_extension": "(확장자 없음)",
  "main.trash.dialog.more": "... 외 {count}개",
  "Unable to render this section. Other features remain available.":
    "이 섹션을 렌더링하지 못했습니다. 다른 기능은 계속 사용할 수 있습니다.",
  "docker.page.retry": "다시 시도",
  "timeline.page.title": "타임라인",
  "timeline.page.description": "시스템 상태 히스토리 및 이벤트 타임라인",
  "timeline.range.24h": "24시간",
  "timeline.range.7d": "7일",
  "timeline.range.30d": "30일",
  "timeline.loading": "타임라인 데이터 로딩 중...",
  "timeline.empty": "아직 타임라인 데이터가 없습니다. 모니터링 시작 후 몇 분 뒤에 데이터가 표시됩니다.",
  "timeline.point_detail.title": "상세 정보",
  "timeline.point_detail.top_processes": "상위 프로세스",
  "timeline.events.title": "이벤트 히스토리",
  "timeline.events.empty": "아직 기록된 이벤트가 없습니다.",
  "timeline.events.filter.all": "전체",
  "timeline.events.filter.disk_cleanup": "디스크 정리",
  "timeline.events.filter.docker_cleanup": "Docker 정리",
  "timeline.events.filter.app_removal": "앱 제거",
  "timeline.events.filter.settings_change": "설정",
  "diagnosis.title": "시스템 진단",
  "diagnosis.empty": "감지된 문제가 없습니다. 시스템이 정상입니다.",
  "diagnosis.severity.info": "정보",
  "diagnosis.severity.warning": "경고",
  "diagnosis.severity.critical": "심각",
  "diagnosis.evidence": "근거",
  "diagnosis.actions": "권장 조치",
  "diagnosis.category.memory_pressure": "메모리 압박",
  "diagnosis.category.cpu_runaway": "비정상 프로세스",
  "diagnosis.category.disk_bottleneck": "디스크 병목",
  "diagnosis.category.disk_space_low": "디스크 공간 부족",
  "diagnosis.category.docker_reclaimable": "Docker 회수 가능",
  "diagnosis.category.cache_bloat": "캐시 비대",
  "diagnosis.category.swap_usage": "높은 스왑 사용",
  "diagnosis.category.network_saturation": "네트워크 포화",
  "diagnosis.analyzed_at": "마지막 분석",
  "alert.intelligence.title": "알림 인텔리전스",
  "alert.intelligence.sustained": "지속 알림",
  "alert.intelligence.sustained_desc": "5분 이상 지속된 알림",
  "alert.intelligence.patterns": "알림 패턴",
  "alert.intelligence.patterns_desc": "최근 24시간 반복된 알림",
  "alert.intelligence.occurrences": "회 발생",
  "cleanup.rules.title": "정리 규칙",
  "cleanup.rules.description": "자동 정리 규칙을 설정합니다",
  "cleanup.rules.empty": "설정된 정리 규칙이 없습니다.",
  "cleanup.rule.downloads_old_files": "오래된 다운로드",
  "cleanup.rule.xcode_derived_data": "Xcode DerivedData",
  "cleanup.rule.xcode_archives": "Xcode Archives",
  "cleanup.rule.npm_cache": "npm 캐시",
  "cleanup.rule.pnpm_cache": "pnpm 캐시",
  "cleanup.rule.yarn_cache": "Yarn 캐시",
  "cleanup.rule.docker_stopped_containers": "Docker 중지된 컨테이너",
  "cleanup.rule.old_logs": "오래된 로그 파일",
  "cleanup.rule.temp_files": "임시 파일",
  "cleanup.preview.title": "정리 미리보기",
  "cleanup.preview.empty": "정리 규칙에 해당하는 항목이 없습니다.",
  "cleanup.preview.total": "회수 가능 용량",
  "cleanup.preview.scanning": "정리 대상 검색 중...",
  "cleanup.execute.confirm": "선택한 항목을 휴지통으로 이동하시겠습니까?",
  "cleanup.execute.success": "정리 완료",
  "cleanup.execute.failed": "일부 항목을 정리할 수 없습니다",
  "cleanup.inbox.title": "정리 인박스",
  "cleanup.inbox.description": "정리 추천 항목을 검토하고 승인합니다",
  "cleanup.inbox.empty": "정리 추천 항목이 없습니다. 시스템이 깨끗합니다.",
  "cleanup.inbox.approve_all": "전체 승인",
  "devtools.safety.safe": "안전",
  "devtools.safety.caution": "주의",
  "devtools.safety.risky": "위험",
  "cleanup.schedule.title": "자동화 일정",
  "cleanup.schedule.enabled": "자동 스캔 활성화",
  "cleanup.schedule.frequency": "스캔 주기",
  "cleanup.schedule.frequency.daily": "매일",
  "cleanup.schedule.frequency.weekly": "매주",
  "cleanup.schedule.frequency.manual": "수동",
  "cleanup.schedule.last_run": "마지막 실행",
  "cleanup.schedule.never": "실행 기록 없음",
  "alert.intelligence.no_sustained": "지속 중인 알림이 없습니다.",
  "alert.intelligence.no_patterns": "반복 패턴이 없습니다.",
  "common.less_than_1_minute": "1분 미만",
  "common.minutes_short": "{count}분",
  "common.duration_hm": "{hours}시간 {minutes}분",
  "disk.quick_cleanup.category.devtools": "개발 도구",
  "disk.quick_cleanup.category.packages": "패키지 관리자",
  "Files in Downloads folder older than the configured threshold": "설정된 기준보다 오래된 Downloads 폴더 내 파일",
  "Xcode build cache that can be safely regenerated": "다시 생성 가능한 Xcode 빌드 캐시",
  "Old Xcode archive builds": "오래된 Xcode 아카이브 빌드",
  "npm package download cache": "npm 패키지 다운로드 캐시",
  "pnpm content-addressable store cache": "pnpm content-addressable store 캐시",
  "Yarn package cache": "Yarn 패키지 캐시",
  "Docker containers that are no longer running": "더 이상 실행 중이 아닌 Docker 컨테이너",
  "System and application log files": "시스템 및 애플리케이션 로그 파일",
  "Temporary files and caches": "임시 파일과 캐시",
  "common.less_than_1_day": "1일 미만",
  "common.one_day_ago": "1일 전",
  "common.days_ago": "{count}일 전",
  "common.one_month_ago": "1개월 전",
  "common.months_ago": "{count}개월 전",
  "cleanup.inbox.rule_matched": "{rule} 규칙에 따라 정리 검토 대상으로 분류되었습니다.",
  "CPU Runaway": "CPU 과다 점유",
  "Swap Usage": "스왑 사용량 증가",
  "critical": "심각",
  "warning": "경고",
  "info": "정보",
  "Unable to load the About information.": "정보 창 데이터를 불러오지 못했습니다.",
  "Failed to fetch timeline data": "타임라인 데이터를 불러오지 못했습니다.",
  "Invalid timeline data": "타임라인 데이터 형식이 올바르지 않습니다.",

  // Report
  "dashboard.export_report": "리포트 내보내기",
  "report.title": "진단 리포트 내보내기",
  "report.select_sections": "리포트에 포함할 섹션을 선택하세요.",
  "System Summary": "시스템 요약",
  "Recent History": "최근 히스토리",
  "Active Alerts": "활성 알림",
  "Disk Cleanup Candidates": "디스크 정리 후보",
  "Docker Resources": "Docker 리소스",
  Diagnosis: "진단",
  "report.mask_sensitive_paths": "민감 경로 마스킹",
  "report.mask_description": "리포트에서 홈 디렉토리와 사용자명을 치환합니다.",
  "report.export_markdown": "Markdown으로 내보내기",
  "report.export_json": "JSON으로 내보내기",
  "report.saved": "리포트가 저장되었습니다.",
  "report.generation_failed": "리포트 생성에 실패했습니다.",
  "report.save_cancelled": "저장이 취소되었습니다.",
  "report.building": "리포트 생성 중...",

  // Session Snapshot
  "snapshot.save": "스냅샷 저장",
  "snapshot.label_placeholder": "스냅샷 이름",
  "snapshot.save_description": "현재 시스템 상태 저장",
  "snapshot.empty": "저장된 스냅샷이 없습니다.",
  "snapshot.delete": "스냅샷 삭제",
  "snapshot.compare": "스냅샷 비교",
  "snapshot.select_to_compare": "비교할 스냅샷 두 개를 선택하세요.",
  "snapshot.toast.saved": "스냅샷이 저장되었습니다.",
  "snapshot.toast.deleted": "스냅샷이 삭제되었습니다.",
  "snapshot.saving": "스냅샷 저장 중...",
  "snapshot.diff.before": "이전",
  "snapshot.diff.after": "이후",
  "snapshot.diff.delta": "변화",
  "snapshot.diff.processes.added": "새 프로세스",
  "snapshot.diff.processes.removed": "종료된 프로세스",
  "snapshot.diff.processes.changed": "변경된 프로세스",
  "snapshot.diff.alerts.added": "새 알림",
  "snapshot.diff.alerts.removed": "해제된 알림",
  "snapshot.diff.docker": "Docker 변경",

  // Workspace Profiles
  Profiles: "프로필",
  "profiles.title": "작업 프로필",
  "profiles.description": "사용자 지정 임계값, 정리 규칙, 대시보드 레이아웃을 포함한 작업 프로필을 관리합니다.",
  "profiles.create": "프로필 생성",
  "profiles.edit": "프로필 편집",
  "profiles.delete": "프로필 삭제",
  "profiles.name": "프로필 이름",
  "profiles.icon": "프로필 아이콘",
  "profiles.hidden_widgets": "숨겨진 위젯",
  "profiles.empty": "프로필이 아직 없습니다. 작업 공간별로 임계값과 대시보드 레이아웃을 사용자 지정하려면 프로필을 생성하세요.",
  "profiles.global_no_profile": "글로벌 (프로필 없음)",
  "profiles.active_profile": "활성 프로필",
  "profiles.switch": "프로필 전환",
  "profiles.toast.saved": "프로필이 저장되었습니다.",
  "profiles.toast.deleted": "프로필이 삭제되었습니다.",
  "profiles.toast.activated": "프로필이 활성화되었습니다.",
  "profiles.toast.deactivated": "프로필이 비활성화되었습니다. 글로벌 설정을 사용합니다.",

  // Developer Tools
  "devtools.section.title": "개발 도구",
  "devtools.section.description": "개발 도구와 툴체인 캐시에서 회수 가능한 디스크 공간을 스캔합니다.",
  "devtools.status.ready": "준비됨",
  "devtools.status.not_installed": "미설치",
  "devtools.status.error": "오류",
  "devtools.no_reclaimable": "정리할 항목이 없습니다.",
  "devtools.detail.title": "개발 도구 정리",
  "devtools.detail.select_all": "전체 선택",
  "devtools.detail.deselect_all": "전체 해제",
  "devtools.detail.clean_selected": "선택 항목 정리",
  "devtools.detail.cleaning": "정리 중...",
  "devtools.detail.empty": "회수 가능한 항목이 없습니다.",
  "devtools.tool.homebrew": "Homebrew",
  "devtools.tool.xcode": "Xcode",
  "devtools.tool.vscode": "VS Code",
  "devtools.tool.toolchain": "툴체인 캐시",
  "devtools.scan_failed": "개발 도구 스캔에 실패했습니다.",
  "devtools.clean_failed": "선택한 항목 정리에 실패했습니다.",
  "devtools.detail.done": "완료 — {succeeded}개 정리, {failed}개 실패",
  "snapshot.diff.metric": "항목",

  // Treemap
  "disk.treemap.root": "루트",
  folders: "폴더",
  files: "파일",
  "disk.treemap.drill_down": "클릭하여 하위 폴더 탐색",
  "disk.treemap.of_current_view": "현재 보기 기준",

  // Startup
  "process.tab.startup": "시작 프로그램",
  "startup.description": "로그인 시 실행되는 시작 프로그램을 관리합니다.",
  "startup.empty": "시작 프로그램이 없습니다.",
  "Startup item enabled.": "시작 프로그램이 활성화되었습니다.",
  "Startup item disabled.": "시작 프로그램이 비활성화되었습니다.",
  "startup.toggle_failed": "시작 프로그램 전환에 실패했습니다.",
  "startup.group.user": "사용자",
  "apps.description.sorted_by_name":
    "설치된 앱은 이름순으로 정렬되어 있어 필요한 도구를 쉽게 찾을 수 있습니다.",
  "cleanup.action.clean": "정리",
  "cleanup.automation.empty": "아직 자동 정리가 실행된 적이 없습니다.",
  "cleanup.automation.enable_hint":
    "설정에서 자동화를 활성화하거나 여기서 한 번 실행하면 이력이 쌓이기 시작합니다.",
  "cleanup.automation.executed": "자동 정리가 실행되었습니다.",
  "cleanup.automation.history_title": "자동화 이력",
  "cleanup.automation.no_targets": "안전한 자동화 대상을 찾지 못했습니다.",
  "cleanup.automation.run_now": "지금 실행",
  "cleanup.automation.tab": "자동화",
  "cleanup.confirm.move_safe": "안전한 항목 {count}개({size})를 휴지통으로 이동합니다.",
  "cleanup.confirm.permanent_remove": "항목 {count}개({size})를 영구 삭제합니다.",
  "cleanup.flow.step1": "1. 후보 검토",
  "cleanup.flow.step2": "2. 규칙 설정",
  "cleanup.flow.step3": "3. 작업공간 정리",
  "cleanup.flow.step4": "4. 이력 확인",
  "cleanup.inbox.scan_now": "지금 스캔",
  "cleanup.preview.error.run": "정리 미리보기를 실행할 수 없습니다.",
  "cleanup.preview.items": "항목",
  "cleanup.preview.rule": "규칙",
  "cleanup.reclaimed_size": "회수 용량: {size}",
  "cleanup.rules.min_age": "최소 기간",
  "cleanup.workspace.choose_another_folder": "다른 폴더 선택",
  "cleanup.workspace.choose_folder": "폴더 선택",
  "cleanup.workspace.cleanup_title": "작업공간 정리",
  "cleanup.workspace.detailed_file_review": "파일 상세 검토",
  "cleanup.workspace.scanning_folder": "선택한 폴더를 스캔하고 있습니다.",
  "cleanup.workspace.tab": "작업공간",
  "cleanup.workspace.title": "작업공간 정리",
  "common.calculating": "계산 중...",
  "common.count_deleted": "{count}개 삭제됨",
  "days": "일",
  "common.error.open_folder": "폴더를 열 수 없습니다.",
  "reclaimable": "회수 가능",
  "common.save": "저장",
  "common.select_all": "전체 선택",
  "common.show_all_count": "모두 보기 ({count})",
  "failed": "실패",
  "common.status.running": "실행 중...",
  "dashboard.customize_hint": "프로필로 대시보드 위젯을 맞춤 설정",
  "devtools.environment.description":
    "세션을 시작하기 전에 로컬 개발 도구의 설치 여부와 준비 상태를 확인합니다.",
  "devtools.environment.empty": "현재 사용 가능한 환경 검사가 없습니다.",
  "devtools.environment.title": "환경 상태",
  "devtools.project_monitor.error.refresh": "프로젝트 모니터를 새로고침할 수 없습니다.",
  "devtools.runtime.empty":
    "현재 수신 대기 중인 포트에서 활성 개발 서버가 감지되지 않았습니다.",
  "devtools.runtime.inspect_port": "포트 검사",
  "devtools.runtime.open_workspace": "작업공간 열기",
  "devtools.section.dev_servers": "개발 서버",
  "devtools.section.environment": "개발 환경",
  "devtools.section.git_insights": "작업공간 Git 인사이트",
  "devtools.section.project_monitor": "프로젝트 모니터",
  "devtools.tab.workspaces": "작업공간",
  "devtools.workspace.activate_profile_first": "추적 폴더를 추가하기 전에 작업공간 프로필을 활성화하세요.",
  "devtools.workspace.activate_profile_hint":
    "개발 도구에서 추적 작업공간을 관리하려면 작업공간 프로필을 활성화하세요.",
  "devtools.workspace.add": "작업공간 추가",
  "devtools.workspace.add_paths_hint":
    "활성 프로필에 작업공간 경로를 추가하면 여기에서 Git 인사이트를 확인할 수 있습니다.",
  "devtools.workspace.all": "전체 작업공간",
  "devtools.workspace.already_tracked": "이 작업공간은 이미 추적 중입니다.",
  "devtools.workspace.branch": "브랜치",
  "devtools.workspace.dirty": "변경됨",
  "devtools.workspace.error.add": "활성 프로필에 작업공간을 추가할 수 없습니다.",
  "devtools.workspace.error.remove": "활성 프로필에서 작업공간을 제거할 수 없습니다.",
  "devtools.workspace.large_untracked_files": "추적되지 않는 대용량 파일",
  "devtools.workspace.last_commit": "마지막 커밋",
  "devtools.workspace.max_reached":
    "이 프로필의 최대 추적 작업공간 수에 도달했습니다.",
  "devtools.workspace.more_available":
    "개발 도구 > 작업공간에서 {count}개의 추가 작업공간을 확인할 수 있습니다.",
  "devtools.workspace.no_match": "현재 선택과 일치하는 작업공간이 없습니다.",
  "devtools.workspace.no_repo": "저장소 없음",
  "devtools.workspace.stash": "스태시",
  "devtools.workspace.toast.added": "작업공간이 추가되었습니다.",
  "devtools.workspace.toast.removed": "작업공간이 제거되었습니다.",
  "devtools.workspace.tracked_count": "작업공간 {count}개 추적 중",
  "devtools.workspace.untracked": "추적 안 됨",
  "diagnosis.detected_at": "감지 시각",
  "diagnosis.empty_detail": "감지된 문제가 없습니다. 시스템이 원활하게 실행 중입니다.",
  "diagnosis.healthy": "정상",
  "diagnosis.metric": "지표",
  "diagnosis.snapshot": "진단 스냅샷",
  "diagnosis.threshold": "임계값",
  "diagnosis.value": "값",
  "monitoring.category_breakdown": "카테고리 분류",
  "monitoring.growth_size": "증가량: {size}",
  "monitoring.recent_trend": "최근 추세",
  "ports.conflict_count": "충돌 {count}건",
  "ports.conflict.common_in_use": "현재 사용 중인 주요 개발 포트",
  "ports.conflict.empty": "현재 감지된 주요 개발 포트 충돌이 없습니다.",
  "ports.conflict.hint":
    "3000, 5173, 5432, 8080 같은 포트가 점유되면 여기에 표시됩니다.",
  "ports.conflict.recommend_port": "{reason} 다음으로 {port} 포트를 시도해 보세요.",
  "ports.conflict.title": "포트 충돌 센터",
  "ports.exposure": "노출",
  "ports.search_placeholder": "프로세스 이름 또는 PID로 검색",
  "ports.sort_description":
    "수신 대기 포트를 우선 표시한 뒤 로컬 포트순으로 정렬합니다",
  "ports.stats.exposed_bindings": "외부 노출 바인딩",
  "ports.stats.exposed_note": "비루프백 주소에서 수신 대기 중",
  "ports.stats.listening_count": "수신 대기 {count}",
  "ports.stats.listening_note": "현재 인바운드 연결을 수락 중인 포트",
  "ports.stats.listening_ports": "수신 대기 포트",
  "ports.stats.localhost_note": "127.0.0.1, ::1 또는 localhost에만 바인딩됨",
  "ports.stats.localhost_only": "로컬호스트 전용",
  "ports.stats.owning_note": "수신 대기 포트를 보유한 고유 PID",
  "ports.stats.owning_processes": "소유 프로세스",
  "profiles.add_workspace_folder": "작업공간 폴더 추가",
  "profiles.automation_title": "프로필 자동화",
  "profiles.override_automation": "전역 자동화 일정 덮어쓰기",
  "profiles.tracked_workspaces": "추적 작업공간",
  "snapshot.error.save": "스냅샷을 저장할 수 없습니다.",
};
