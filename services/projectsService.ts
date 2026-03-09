/**
 * projectsService.ts
 * Save / load projects to/from the Supabase `projects` table.
 * Images are stored in Supabase Storage (bucket: project-images).
 * Uses Supabase JS client for all DB operations (proper RLS auth).
 */
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseClient';
import { Order } from '../types';

const STORAGE_BUCKET = 'project-images';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if a string is a base64 data URI */
function isBase64(str: string): boolean {
    return str.startsWith('data:image/');
}

/** Convert a base64 data URI to a Blob for upload */
function base64ToBlob(base64: string): Blob {
    const [header, data] = base64.split(',');
    const mime = header.match(/data:(.*?);/)?.[1] || 'image/png';
    const bytes = atob(data);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

/** Upload a base64 image to Supabase Storage via direct fetch, returns the public URL */
async function uploadImageToStorage(
    base64: string,
    storagePath: string,
    accessToken: string
): Promise<string | null> {
    try {
        const blob = base64ToBlob(base64);
        const url = `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`;

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': blob.type,
                'x-upsert': 'true',
            },
            body: blob,
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[Storage] Upload failed:', res.status, errText);
            return null;
        }

        // Return the public URL
        return `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;
    } catch (err) {
        console.error('[Storage] Upload error:', err);
        return null;
    }
}

/** Compress a base64 image to JPEG at reduced resolution for DB storage fallback */
async function compressImage(base64: string, maxWidth = 1200, quality = 0.7): Promise<string> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, maxWidth / img.naturalWidth);
            canvas.width = img.naturalWidth * scale;
            canvas.height = img.naturalHeight * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(base64); // fallback to original
            }
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
}

/** Upload all base64 images in an order to Storage, returns jobs with URLs */
async function uploadJobImages(
    order: Order,
    userId: string,
    accessToken: string
): Promise<{ jobs: Order['jobs']; thumbnailUrl: string | null }> {
    const projectFolder = `${userId}/${order.dbId || order.id}`;
    let thumbnailUrl: string | null = null;

    const uploadedJobs = await Promise.all(
        order.jobs.map(async (job) => {
            let processedUrl = job.processedImage || '';
            let originalUrl = job.originalImage || '';

            // Upload originalImage if it's base64
            if (originalUrl && isBase64(originalUrl)) {
                const ext = originalUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
                const path = `${projectFolder}/${job.id}_original.${ext}`;
                const url = await uploadImageToStorage(originalUrl, path, accessToken);
                if (url) {
                    originalUrl = url;
                    console.log(`[projectsService] ✅ Uploaded original ${job.id}`);
                } else {
                    originalUrl = ''; // Can't save, drop it
                }
            }

            // Upload processedImage if it's base64
            if (processedUrl && isBase64(processedUrl)) {
                const ext = processedUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
                const path = `${projectFolder}/${job.id}_processed.${ext}`;
                const url = await uploadImageToStorage(processedUrl, path, accessToken);
                if (url) {
                    processedUrl = url;
                    if (!thumbnailUrl) thumbnailUrl = url;
                    console.log(`[projectsService] ✅ Uploaded processed ${job.id}`);
                } else {
                    // Storage upload failed — compress image for DB fallback
                    console.warn(`[projectsService] ⚠️ Storage upload failed for ${job.id}, compressing...`);
                    processedUrl = await compressImage(processedUrl);
                    if (!thumbnailUrl) {
                        thumbnailUrl = await compressImage(job.processedImage || '', 600, 0.5);
                    }
                }
            }

            return {
                ...job,
                originalImage: originalUrl,
                processedImage: processedUrl,
            };
        })
    );

    return { jobs: uploadedJobs, thumbnailUrl };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Create a lightweight project record immediately when processing starts.
 * Uses direct fetch() to bypass Supabase JS client auth issues.
 * Returns the Supabase-generated UUID.
 */
export async function createProjectRecord(order: Order, userId: string, accessToken: string): Promise<string | null> {
    try {
        console.log('[projectsService] Creating project record (fetch)...');
        const url = `${SUPABASE_URL}/rest/v1/projects`;
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation',
            },
            body: JSON.stringify({
                user_id: userId,
                title: order.vin || order.title || 'Processing...',
                vin: order.vin || '',
                status: 'processing',
                task_type: order.taskType,
                studio_id: order.studioId,
                photo_count: order.jobs.length,
                thumbnail_url: null,
                jobs: [],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] createProjectRecord error:', res.status, errText);
            return null;
        }

        const rows = await res.json();
        const id = Array.isArray(rows) ? rows[0]?.id : rows?.id;
        console.log('[projectsService] Project record created:', id);
        return id ?? null;
    } catch (err) {
        console.error('[projectsService] createProjectRecord error:', err);
        return null;
    }
}

/**
 * Persist a completed order to the `projects` table.
 * Uses direct fetch() to bypass Supabase JS client auth issues.
 * If dbId is set (from createProjectRecord), updates that row. Otherwise inserts.
 */
export async function saveProject(order: Order, userId: string, accessToken: string): Promise<string | null> {
    try {
        // Upload images to Storage first
        console.log('[projectsService] Uploading images to Storage...');
        const { jobs, thumbnailUrl } = await uploadJobImages(order, userId, accessToken);
        console.log('[projectsService] Upload complete. Saving project row...');

        const projectData = {
            user_id: userId,
            title: order.vin || order.title,
            vin: order.vin || '',
            status: order.status,
            task_type: order.taskType,
            studio_id: order.studioId,
            photo_count: order.jobs.length,
            thumbnail_url: thumbnailUrl,
            jobs: jobs,
        };

        let res: Response;

        if (order.dbId) {
            // PATCH existing row
            res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${order.dbId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify(projectData),
            });
        } else {
            // POST new row
            res = await fetch(`${SUPABASE_URL}/rest/v1/projects`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation',
                },
                body: JSON.stringify(projectData),
            });
        }

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] saveProject error:', res.status, errText);
            return null;
        }

        const rows = await res.json();
        const id = Array.isArray(rows) ? rows[0]?.id : rows?.id;
        console.log('[projectsService] Project saved successfully:', id);
        return id ?? null;
    } catch (err) {
        console.error('[projectsService] saveProject error:', err);
        return null;
    }
}

/**
 * Upload a single processed job image to Storage and update the project row.
 * Called after each image is processed for progressive saving.
 * Uses direct fetch() to bypass Supabase JS client issues.
 */
export async function saveJobImage(
    order: Order,
    userId: string,
    jobId: string,
    processedImage: string,
    accessToken: string
): Promise<void> {
    const dbId = order.dbId;
    if (!dbId) {
        console.warn('[projectsService] saveJobImage skipped — no dbId yet');
        return;
    }

    try {
        const projectFolder = `${userId}/${dbId}`;
        let imageUrl = processedImage;
        const jobData = order.jobs.find(j => j.id === jobId);
        let originalUrl = jobData?.originalImage || '';

        // Upload original to Storage if it's base64
        if (originalUrl && isBase64(originalUrl)) {
            const ext = originalUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
            const path = `${projectFolder}/${jobId}_original.${ext}`;
            const url = await uploadImageToStorage(originalUrl, path, accessToken);
            if (url) {
                originalUrl = url;
                console.log(`[projectsService] ✅ Uploaded original ${jobId}`);
            } else {
                originalUrl = '';
            }
        }

        // Upload processed to Storage if it's base64
        if (isBase64(processedImage)) {
            const ext = processedImage.startsWith('data:image/jpeg') ? 'jpg' : 'png';
            const path = `${projectFolder}/${jobId}_processed.${ext}`;
            const url = await uploadImageToStorage(processedImage, path, accessToken);
            if (url) {
                imageUrl = url;
                console.log(`[projectsService] ✅ Uploaded processed ${jobId}`);
            } else {
                console.warn(`[projectsService] ⚠️ Storage upload failed for ${jobId}`);
                return;
            }
        }

        // GET current project data to merge the new job
        const getRes = await fetch(
            `${SUPABASE_URL}/rest/v1/projects?id=eq.${dbId}&select=jobs,thumbnail_url`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );
        const rows = getRes.ok ? await getRes.json() : [];
        const existing = rows[0] || {};

        const currentJobs: any[] = existing.jobs || [];
        const jobIndex = currentJobs.findIndex((j: any) => j.id === jobId);
        const jobEntry = { id: jobId, angle: jobData?.angle || '', processedImage: imageUrl, status: 'completed', originalImage: originalUrl };

        if (jobIndex >= 0) {
            currentJobs[jobIndex] = jobEntry;
        } else {
            currentJobs.push(jobEntry);
        }

        const allJobsDone = currentJobs.length === order.jobs.length && currentJobs.every((j: any) => j.status === 'completed' || j.status === 'failed');

        const patch: Record<string, any> = {
            jobs: currentJobs,
            status: allJobsDone ? 'completed' : 'processing',
        };

        if (!existing.thumbnail_url) {
            patch.thumbnail_url = imageUrl;
        }

        // PATCH the project row
        await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${dbId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patch),
        });

        console.log(`[projectsService] Project updated with job ${jobId}`);
    } catch (err) {
        console.error('[projectsService] saveJobImage error:', err);
    }
}

/**
 * Update an existing project row.
 */
export async function updateProject(
    projectId: string,
    patch: Partial<Pick<Order, 'status' | 'jobs'>> & { thumbnail_url?: string }
): Promise<void> {
    try {
        const body: Record<string, any> = {};
        if (patch.status) body.status = patch.status;
        if (patch.thumbnail_url) body.thumbnail_url = patch.thumbnail_url;
        if (patch.jobs) body.jobs = patch.jobs.map(j => ({ ...j, originalImage: '' }));

        const { error } = await supabase
            .from('projects')
            .update(body)
            .eq('id', projectId);

        if (error) {
            console.error('[projectsService] updateProject error:', error.message);
        }
    } catch (err) {
        console.error('[projectsService] updateProject error:', err);
    }
}

/**
 * Load all projects for a user, most recent first.
 * Uses direct fetch to avoid Supabase client AbortController issues with React re-renders.
 * Only fetches lightweight fields — NOT the huge jobs JSONB column.
 */
export async function loadProjects(userId: string, accessToken: string): Promise<Order[]> {
    try {
        if (!accessToken) {
            console.warn('[projectsService] No access token provided');
            return [];
        }

        const fields = 'id,title,vin,created_at,status,studio_id,task_type,photo_count,thumbnail_url,jobs';
        const url = `${SUPABASE_URL}/rest/v1/projects?select=${fields}&user_id=eq.${userId}&order=created_at.desc`;

        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] loadProjects error:', res.status, errText);
            return [];
        }

        const data = await res.json();
        return (data ?? []).map((row: any) => ({
            id: row.id,
            dbId: row.id,
            title: row.title,
            vin: row.vin || '',
            createdAt: row.created_at,
            status: row.status,
            jobs: row.jobs ?? [],
            studioId: row.studio_id,
            taskType: row.task_type,
            thumbnailUrl: row.thumbnail_url,
        }));
    } catch (err) {
        console.error('[projectsService] loadProjects error:', err);
        return [];
    }
}

/**
 * Load a single project by ID with full job data.
 */
export async function loadProjectById(projectId: string, accessToken: string): Promise<Order | null> {
    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}&select=*`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                },
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] loadProjectById error:', res.status, errText);
            return null;
        }

        const rows = await res.json();
        const data = rows[0];
        if (!data) return null;

        return {
            id: data.id,
            dbId: data.id,
            title: data.title,
            vin: data.vin || '',
            createdAt: data.created_at,
            status: data.status,
            jobs: data.jobs ?? [],
            studioId: data.studio_id,
            taskType: data.task_type,
            thumbnailUrl: data.thumbnail_url,
        };
    } catch (err) {
        console.error('[projectsService] loadProjectById error:', err);
        return null;
    }
}

/**
 * Permanently delete a project from the database.
 */
export async function deleteProject(projectId: string, accessToken: string): Promise<boolean> {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] deleteProject error:', res.status, errText);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[projectsService] deleteProject error:', err);
        return false;
    }
}

/**
 * Rename a project (updates the title column).
 */
export async function renameProject(projectId: string, newTitle: string, accessToken: string): Promise<boolean> {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/projects?id=eq.${projectId}`, {
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: newTitle }),
        });

        if (!res.ok) {
            const errText = await res.text();
            console.error('[projectsService] renameProject error:', res.status, errText);
            return false;
        }
        return true;
    } catch (err) {
        console.error('[projectsService] renameProject error:', err);
        return false;
    }
}
