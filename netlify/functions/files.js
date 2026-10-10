// =============================================================================
// Netlify Function: files.js
// Public file catalog & Admin file management API
// =============================================================================

const { 
  getPublicFiles, 
  getFileById, 
  getAllFilesAdmin, 
  createFile, 
  updateFile, 
  deleteFile,
  deleteMultipleFiles 
} = require('./utils/db');
const { verifyAdminAuth, getSecurityHeaders } = require('./utils/auth-middleware');

exports.handler = async (event, context) => {
  const headers = getSecurityHeaders();

  // Handle CORS Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const query = event.queryStringParameters || {};
  const method = event.httpMethod;

  try {
    // -------------------------------------------------------------------------
    // GET: Public Catalog or Admin Listing or Single File Details
    // -------------------------------------------------------------------------
    if (method === 'GET') {
      // 1. Single File Details
      if (query.id) {
        const file = await getFileById(query.id);
        if (!file) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'File not found' })
          };
        }

        // Check if admin is requesting full details
        const auth = verifyAdminAuth(event.headers);
        if (auth.authorized) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, file })
          };
        }

        // Public Safe View - Strip internal/secure source references
        const safeFile = {
          id: file.id,
          file_code: file.file_code,
          title: file.title,
          description: file.description,
          category: file.category,
          file_type: file.file_type,
          file_size: file.file_size,
          preview_url: file.preview_url,
          download_count: file.download_count,
          version: file.version,
          source_type: file.source_type,
          created_at: file.created_at
        };

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, file: safeFile })
        };
      }

      // 2. Admin All Files (if admin param or admin header provided)
      if (query.admin === 'true') {
        const auth = verifyAdminAuth(event.headers);
        if (!auth.authorized) {
          return {
            statusCode: 401,
            headers,
            body: JSON.stringify({ error: auth.error })
          };
        }
        const files = await getAllFilesAdmin();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, files })
        };
      }

      // 3. Public Catalog List
      const files = await getPublicFiles({
        category: query.category,
        search: query.search
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, files })
      };
    }

    // -------------------------------------------------------------------------
    // Protected Methods: POST, PUT, DELETE require Admin Authentication
    // -------------------------------------------------------------------------
    const auth = verifyAdminAuth(event.headers);
    if (!auth.authorized) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: auth.error })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};

    // POST: Create File
    if (method === 'POST') {
      if (!body.title) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Title is required' })
        };
      }
      const newFile = await createFile(body);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, file: newFile })
      };
    }

    // PUT: Update File
    if (method === 'PUT') {
      if (!body.id) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'File ID is required for update' })
        };
      }
      const updated = await updateFile(body.id, body);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, file: updated })
      };
    }

    // DELETE: Delete or Archive File(s) (Supports single ID or array of IDs)
    if (method === 'DELETE') {
      const ids = body.ids || (body.id ? [body.id] : null) || (query.ids ? query.ids.split(',') : null) || (query.id ? [query.id] : null);
      if (!ids || ids.length === 0) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'File ID or array of IDs is required' })
        };
      }
      await deleteMultipleFiles(ids, query.hard !== 'false');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: ids.length === 1 ? 'File deleted successfully' : `${ids.length} files deleted successfully`,
          deleted_ids: ids
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Error in files function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
