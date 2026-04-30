const POOLS = {
  zh: {
    adjectives: [
      "進擊的",
      "滑溜溜的",
      "毛茸茸的",
      "軟綿綿的",
      "肚子餓的",
      "迷路的",
      "打瞌睡的",
      "發呆的",
      "害羞的",
      "偷懶的",
      "暖烘烘的",
      "圓滾滾的",
      "傻乎乎的",
      "蓬鬆的",
      "搖搖晃晃的",
      "閃亮亮的",
      "咕嚕咕嚕的",
      "夢幻的",
      "閃爍的",
      "灑脫的",
    ],
    nouns: [
      "雞塊",
      "豆漿",
      "吐司",
      "哥布林",
      "草泥馬",
      "可頌",
      "珍珠",
      "布丁",
      "馬鈴薯",
      "烏龜",
      "仙人掌",
      "鬆餅",
      "章魚",
      "貓掌",
      "年糕",
      "芒果",
      "棉被",
      "餃子",
      "蘿蔔",
      "麻糬",
    ],
    titles: ["領主", "二世", "觀測者", "愛好者", "守護者", "研究員", "漫遊者", "繼承人", "特派員", "見習生"],
  },
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Builds a random funny anonymous display name for the given UI language.
 * Call when a chat room is created (or when assigning a participant); store the
 * return value on the chat / participant document in Firestore so it stays fixed
 * for that session. Each call returns a new random name.
 *
 * @param {"zh" | "en" | "ja" | string} language
 * @returns {string}
 */
export function generateAnonymousName(language) {
  void language;
  const { adjectives, nouns, titles } = POOLS.zh;
  const adjective = pick(adjectives);
  const noun = pick(nouns);
  const title = pick(titles);

  return `${adjective}${noun}${title}`;
}
