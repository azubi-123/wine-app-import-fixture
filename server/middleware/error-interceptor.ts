import { Request, Response, NextFunction } from 'express';

/**
 * Comprehensive error interceptor middleware for debugging 500 errors
 */
export function errorInterceptor(err: any, req: Request, res: Response, next: NextFunction) {
  // Generate unique error ID for tracking
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Comprehensive error logging
  console.error(`\n${'='.repeat(80)}`);
  console.error(`[ERROR_INTERCEPTOR] ${errorId}`);
  console.error(`Timestamp: ${new Date().toISOString()}`);
  console.error(`${'='.repeat(80)}`);
  
  // Request details
  console.error('\n📥 REQUEST DETAILS:');
  console.error(`Method: ${req.method}`);
  console.error(`URL: ${req.originalUrl}`);
  console.error(`Params:`, req.params);
  console.error(`Query:`, req.query);
  console.error(`Body:`, JSON.stringify(req.body, null, 2));
  console.error(`Headers:`, {
    'content-type': req.get('content-type'),
    'user-agent': req.get('user-agent'),
    'content-length': req.get('content-length')
  });
  
  // Error details
  console.error('\n❌ ERROR DETAILS:');
  console.error(`Name: ${err.name}`);
  console.error(`Message: ${err.message}`);
  console.error(`Stack:`, err.stack);
  
  // Database error specifics
  if (err.code) {
    console.error('\n🗄️ DATABASE ERROR:');
    console.error(`Code: ${err.code}`);
    console.error(`Detail: ${err.detail}`);
    console.error(`Table: ${err.table}`);
    console.error(`Column: ${err.column}`);
    console.error(`Constraint: ${err.constraint}`);
    console.error(`Data Type: ${err.dataType}`);
    console.error(`Routine: ${err.routine}`);
  }
  
  console.error(`\n${'='.repeat(80)}\n`);
  
  // Determine response based on error type
  let statusCode = 500;
  let errorResponse: any = {
    message: 'Internal server error',
    errorId: errorId,
    timestamp: new Date().toISOString()
  };
  
  // Handle specific PostgreSQL errors
  if (err.code === '22P02') {
    statusCode = 400;
    errorResponse.message = 'Invalid data format';
    errorResponse.errorCode = 'INVALID_FORMAT';
  } else if (err.code === '23503') {
    statusCode = 400;
    errorResponse.message = 'Referenced entity does not exist';
    errorResponse.errorCode = 'FOREIGN_KEY_VIOLATION';
  } else if (err.code === '23505') {
    statusCode = 409;
    errorResponse.message = 'Entity already exists';
    errorResponse.errorCode = 'DUPLICATE_ENTRY';
  }
  
  // Add debug info in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.debug = {
      error: err.message,
      code: err.code,
      detail: err.detail
    };
  }
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}