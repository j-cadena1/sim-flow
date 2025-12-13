/**
 * CSP Violation Report Endpoint
 *
 * Receives Content-Security-Policy violation reports from browsers.
 * These reports are sent automatically when a CSP directive is violated.
 *
 * Report format (CSP Level 2):
 * {
 *   "csp-report": {
 *     "document-uri": "https://example.com/page",
 *     "referrer": "",
 *     "violated-directive": "script-src 'self'",
 *     "effective-directive": "script-src",
 *     "original-policy": "...",
 *     "blocked-uri": "https://evil.com/script.js",
 *     "status-code": 200
 *   }
 * }
 *
 * @module routes/cspReport
 */

import { Router, Request, Response } from 'express';
import { logger } from '../middleware/logger';
import { cspReportLimiter } from '../middleware/rateLimiter';

const router = Router();

/** CSP report structure (CSP Level 2 format) */
interface CSPReport {
  'csp-report': {
    'document-uri'?: string;
    'referrer'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'blocked-uri'?: string;
    'disposition'?: string;
    'status-code'?: number;
    'script-sample'?: string;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

/**
 * Sanitize a URI for logging (remove query params which may contain sensitive data)
 */
function sanitizeUri(uri: string | undefined): string {
  if (!uri) return 'unknown';
  try {
    const url = new URL(uri);
    return `${url.origin}${url.pathname}`;
  } catch {
    // If parsing fails, just return a truncated version
    return uri.substring(0, 100);
  }
}

/**
 * @swagger
 * /csp-report:
 *   post:
 *     summary: Receive CSP violation report
 *     tags: [Security]
 *     description: |
 *       Endpoint for browsers to report Content-Security-Policy violations.
 *       This endpoint is called automatically by browsers when a CSP directive is violated.
 *       Reports are logged for security monitoring.
 *     requestBody:
 *       required: true
 *       content:
 *         application/csp-report:
 *           schema:
 *             type: object
 *             properties:
 *               csp-report:
 *                 type: object
 *                 properties:
 *                   document-uri:
 *                     type: string
 *                   violated-directive:
 *                     type: string
 *                   blocked-uri:
 *                     type: string
 *     responses:
 *       204:
 *         description: Report received successfully
 *       400:
 *         description: Invalid report format
 */
router.post(
  '/csp-report',
  cspReportLimiter,
  // CSP reports use application/csp-report content type
  // Express needs to parse this as JSON
  (req: Request, res: Response) => {
    try {
      const report = req.body as CSPReport;

      // Validate report structure
      if (!report || !report['csp-report']) {
        logger.warn('Received malformed CSP report', {
          contentType: req.get('Content-Type'),
          bodyKeys: Object.keys(req.body || {}),
        });
        return res.status(400).send();
      }

      const cspReport = report['csp-report'];

      // Log the violation with sanitized data (no PII, no full URLs with query params)
      logger.warn('CSP Violation detected', {
        documentUri: sanitizeUri(cspReport['document-uri']),
        violatedDirective: cspReport['violated-directive'],
        effectiveDirective: cspReport['effective-directive'],
        blockedUri: sanitizeUri(cspReport['blocked-uri']),
        disposition: cspReport['disposition'] || 'enforce',
        sourceFile: cspReport['source-file']
          ? sanitizeUri(cspReport['source-file'])
          : undefined,
        lineNumber: cspReport['line-number'],
      });

      // Return 204 No Content (standard response for CSP reports)
      return res.status(204).send();
    } catch (error) {
      logger.error('Error processing CSP report', { error });
      return res.status(204).send(); // Still return 204 to not expose errors
    }
  }
);

export default router;
