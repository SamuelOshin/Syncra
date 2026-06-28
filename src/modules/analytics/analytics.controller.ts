import { Request, Response, NextFunction } from 'express';
import { MeetingRepository } from '../meeting/meeting.repository';
import { GlossaryRepository } from '../glossary/glossary.repository';
import { TranslationMemoryRepository } from '../translation-memory/tm.repository';
import { successResponse } from '../../utils/response';

const meetingRepository = new MeetingRepository();
const glossaryRepository = new GlossaryRepository();
const tmRepository = new TranslationMemoryRepository();

export class AnalyticsController {
  async getOverviewStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session.user!.id;

      const [totalMeetings, allTranscripts, glossaryTerms, tmSegments] = await Promise.all([
        meetingRepository.countByHostId(userId),
        meetingRepository.findTranscriptsByHostId(userId),
        glossaryRepository.findByUserId(userId),
        tmRepository.findByUserId(userId),
      ]);

      let totalWords = 0;
      allTranscripts.forEach(t => {
        totalWords += t.originalText.split(/\s+/).filter(Boolean).length;
      });

      const latencies = allTranscripts
        .map(t => parseFloat(t.latency as string))
        .filter(l => !isNaN(l) && l > 0);
      
      const avgLatency = latencies.length > 0
        ? parseFloat((latencies.reduce((sum, l) => sum + l, 0) / latencies.length).toFixed(2))
        : 0.45;

      const totalSavedTerms = glossaryTerms.length + tmSegments.length;
      const chartData: { date: string; words: number }[] = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dateString = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        chartData.push({ date: dateString, words: 0 });
      }

      allTranscripts.forEach(t => {
        if (t.createdAt) {
          const segmentDate = new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          const dataPoint = chartData.find(cd => cd.date === segmentDate);
          if (dataPoint) {
            dataPoint.words += t.originalText.split(/\s+/).filter(Boolean).length;
          }
        }
      });

      successResponse(res, 200, 'Analytics retrieved successfully', {
        stats: {
          totalMeetings,
          totalWords,
          avgLatency,
          totalSavedTerms
        },
        chartData
      });
    } catch (error) {
      next(error);
    }
  }
}
export default AnalyticsController;
