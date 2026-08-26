---
title: "😃 typing-roguelike"
notion_url: "https://app.notion.com/p/3c612168d521804f9ed4c8c7f9471df0?pvs=204"
exported_at: "2026-08-26"
document_type: project-page
---

# 😃 typing-roguelike

> [Notion에서 열기](https://app.notion.com/p/3c612168d521804f9ed4c8c7f9471df0?pvs=204)
> 이 문서는 2026-08-26에 로컬로 추출한 원문 스냅샷입니다.

1. 장르
	1. 로그라이크 장비 빌딩 타자 게임
	2. PVE: 탑 등반
		1. 죽으면 가지고 있던 아이템 싹다 삭제
		2. 살아서 나오면 가지고 있던 아이템을 팔았다 하게 하고 재화 획득
	3. PVE: 협동 레이드
	4. PVP: 결투 (1 : 1)
		1. 탑에서 보스를 깨고 나온 내 영혼으로 전투하기 \<\< 죽을시 삭제 (내가 진짜 개쩌는 졸업논문을 만들었다)
2. 배경
3. 몬스터
	1. 보스: 메인 기술 존재
	2. 엘리트: 보스에 대한 힌트 느낌으로 기술이 있어야함
	3. 잡몹
	4. 괴물
		1. 촉수괴물
		2. 인간형괴물
		3. 슬라임 기타 등등
	5. 사람
		1. 도적
		2. 노련한 탐험가
		3. 기타 등등
4. BM
	1. 캐릭터 뽑기
	2. 스킨
	3.
5. 데모 범위
	1. 처음에 들어가서 게임 하는 방법 안내 및 일반전투 1회, 엘리트 전투1회 후 메인화면으로 복귀
	2. 가챠하는 법 알려주고 가챠 한거 강제로 장착하게하고 탑으로 밀어넣음
	3. 탑 클리어시 차후 스토리 안내 후 끝
6. 플레이어
	1. 타자를 치는게 기본값
	2. 실시간으로 하되, 기술이 날아오는 시간을 두고, 행동력을 제한해서 너무 많이 쓰지는 못하게 한다.
	3. 파이어볼이 날아오는동안 매직실드를 채팅으로 칠 수 있게
	4. 화살이 날아오는동안 방패들기를 채팅으로 칠 수 있게
	5. 휘두르기, 방패들기
	6. 강화 가속 회전 기타 등등 강화 주문 보유
	7. 토탈 몇개 : 무기는 등급에 따라 기본1 시그니처 1\~2개
		1. 세컨더리 2개
		2. 반지 1개
		3. 주문서 1개
	<empty-block/>
	영어 or 한글
	<empty-block/>
<empty-block/>
```javascript
슬더스 : 엘리트 여러마리를 잡고 보스전 -> 여기서 엘리트 몹이 그 해당층에 대한 보스 기믹을 가지고 있지 X

해금 : 어떻게 할건가.

BM : 
	1. 편의성 - 마법의 만년필 \(월 7900\)
	2. 장비 - 가챠
	3. EX: 
	
	
인벤토리 정리 장르 : 게임 도중 장비를 여러개 들고갈 수 있는가? -> 장비 교체가 가 능할지, 인벤에 쌓을지

잡몹전투 : 소모품 or 하급 아이템 or 하급 유물
엘리트 전투 : 중급 이상 장비 드랍
보스 : 전설급 장비, 보스 무기 \(확률 낮음\)




**기믹 혹은 기술에 맞게 적을 디자인하는것이 맞다.**
```
<empty-block/>
```javascript
export function createBandit() {
  return {
    id: 'bandit',
    name: '도적',
    maxHp: 50,
    hp: 50,
    attackName: '화살',
    attackDamage: 20,
    preparationTime: 3000,
    recoveryTime: 2500,
    getPreparationMessage() {
      return '도적이 활시위를 당긴다... 3초 뒤 화살이 날아옵니다!';
    },
  };
}

export function 도적() {
	return {
		체력
		공격력
		방어력
		// 이유 : 
		
	}
	도적 스킬
	베기
	공격력 * 1.4
	활쏘기 * 2
	방어 * 1.7
}
```
<page url="https://app.notion.com/p/3c612168d52181828d2ce0c44d764708">typing-roguelike 초기 제품 스펙 v0.2</page>
<page url="https://app.notion.com/p/3c612168d5218118ac6de6f23d757f5d">typing-roguelike 위키</page>
<empty-block/>
<page url="https://app.notion.com/p/3c712168d52181c89c82f835c7ce8a6b">OpenAI Game Builders Seoul 2026 — 해커톤 정보</page>
<empty-block/>
<database url="https://app.notion.com/p/c6bf6543290c4e7aa72e70740017bafd" inline="false" data-source-url="collection://7ca6504f-e590-40ce-a881-1d1f463b3c3f">CEX Project Kanban</database>
<empty-block/>
<page url="https://app.notion.com/p/3c812168d521814ab0b2da22fc1e26c6">전체 Task 구조 및 구현 흐름</page>

