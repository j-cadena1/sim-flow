import { Request, Response } from 'express';
import {
  getDashboardStats,
  getTimeToCompletionAnalysis,
  getHourAllocationAnalysis,
} from '../services/analyticsService';
import { logger } from '../middleware/logger';

/**
 * Get dashboard statistics with optional date range
 * Admin and Manager roles
 */
export const getDashboardStatistics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    // Validate dates
    if (start && isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid start date' });
    }
    if (end && isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid end date' });
    }
    if (start && end && start > end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const stats = await getDashboardStats(start, end);

    logger.info('Dashboard statistics retrieved successfully');
    res.json({ stats });
  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
};

/**
 * Get time-to-completion analysis by priority
 * Admin and Manager roles
 */
export const getCompletionAnalysis = async (req: Request, res: Response) => {
  try {
    const analysis = await getTimeToCompletionAnalysis();

    logger.info('Time-to-completion analysis retrieved successfully');
    res.json({ analysis });
  } catch (error) {
    logger.error('Error fetching time-to-completion analysis:', error);
    res.status(500).json({ error: 'Failed to fetch time-to-completion analysis' });
  }
};

/**
 * Get hour allocation vs actual usage analysis
 * Admin and Manager roles
 */
export const getAllocationAnalysis = async (req: Request, res: Response) => {
  try {
    const analysis = await getHourAllocationAnalysis();

    logger.info('Hour allocation analysis retrieved successfully');
    res.json({ analysis });
  } catch (error) {
    logger.error('Error fetching hour allocation analysis:', error);
    res.status(500).json({ error: 'Failed to fetch hour allocation analysis' });
  }
};
