export interface RawVote {
  criteriaId: string;
  score: number;
  isJudge: boolean;
}

export interface CriteriaConfig {
  id: string;
  name: string;
  weight: number;
}

export class RatingEngine {
  /**
   * Вычисляет усечённое среднее (Trimmed Mean):
   * Если оценок >= 5, отбрасывает 1 максимальную и 1 минимальную оценку,
   * защищая от троллей (1 звезда) и предвзятых друзей (5 звезд).
   */
  static trimmedMean(scores: number[]): number {
    if (scores.length === 0) return 0;
    if (scores.length < 5) {
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    }

    const sorted = [...scores].sort((a, b) => a - b);
    // Отсекаем крайние элементы
    const trimmed = sorted.slice(1, -1);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }

  /**
   * Байесовское сглаживание (Bayesian Average):
   * S = (C * m + sum(x)) / (C + n)
   * где m = 3.5 (базовое среднее), C = 4 (минимальный доверительный вес).
   * Не дает игре с 1 оценкой 5.0 обойти игру с 30 оценками 4.9.
   */
  static bayesianScore(scores: number[], priorMean = 3.5, confidenceWeight = 4): number {
    if (scores.length === 0) return 0;
    const sum = scores.reduce((a, b) => a + b, 0);
    const n = scores.length;
    return (confidenceWeight * priorMean + sum) / (confidenceWeight + n);
  }

  /**
   * Расчет итоговых показателей работы по критериям с разделением Жюри / Игроки
   */
  static evaluateSubmission(
    criteria: CriteriaConfig[],
    votes: RawVote[],
    votingType: 'PUBLIC' | 'PARTICIPANTS_ONLY' | 'JUDGES_ONLY' | 'HYBRID'
  ) {
    const juryVotes = votes.filter((v) => v.isJudge);
    const peerVotes = votes.filter((v) => !v.isJudge);

    let juryTotalWeighted = 0;
    let peerTotalWeighted = 0;
    let totalWeight = 0;

    const breakdown: Record<string, { juryAvg: number; peerAvg: number; combinedAvg: number }> = {};

    for (const c of criteria) {
      const cJury = juryVotes.filter((v) => v.criteriaId === c.id).map((v) => v.score);
      const cPeer = peerVotes.filter((v) => v.criteriaId === c.id).map((v) => v.score);

      const juryAvg = this.trimmedMean(cJury);
      const peerAvg = this.trimmedMean(cPeer);

      let combinedAvg = 0;
      if (cJury.length > 0 && cPeer.length > 0) {
        combinedAvg = juryAvg * 0.6 + peerAvg * 0.4;
      } else if (cJury.length > 0) {
        combinedAvg = juryAvg;
      } else {
        combinedAvg = peerAvg;
      }

      breakdown[c.name] = {
        juryAvg: Math.round(juryAvg * 100) / 100,
        peerAvg: Math.round(peerAvg * 100) / 100,
        combinedAvg: Math.round(combinedAvg * 100) / 100
      };

      juryTotalWeighted += (juryAvg || 0) * c.weight;
      peerTotalWeighted += (peerAvg || 0) * c.weight;
      totalWeight += c.weight;
    }

    const juryScore = totalWeight > 0 ? Math.round((juryTotalWeighted / totalWeight) * 100) / 100 : 0;
    const peerScore = totalWeight > 0 ? Math.round((peerTotalWeighted / totalWeight) * 100) / 100 : 0;

    let finalScore = 0;
    if (votingType === 'JUDGES_ONLY') {
      finalScore = juryScore;
    } else if (votingType === 'PUBLIC' || votingType === 'PARTICIPANTS_ONLY') {
      finalScore = peerScore;
    } else {
      // HYBRID: 60% жюри + 40% народное
      if (juryVotes.length > 0 && peerVotes.length > 0) {
        finalScore = Math.round((juryScore * 0.6 + peerScore * 0.4) * 100) / 100;
      } else {
        finalScore = juryScore || peerScore;
      }
    }

    return {
      finalScore,
      juryScore,
      peerScore,
      breakdown,
      juryVoteCount: juryVotes.length,
      peerVoteCount: peerVotes.length
    };
  }
}
