// Unsplash API integration for image search
export interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    username: string;
  };
  description?: string;
  alt_description?: string;
  width: number;
  height: number;
  likes: number;
}

export interface UnsplashSearchResponse {
  results: UnsplashPhoto[];
  total: number;
  total_pages: number;
}

// Using curated wine photos without API key requirement
// The service works with demo data by default - no API key needed!
// If you want to use real Unsplash API, get a free key from https://unsplash.com/developers
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const UNSPLASH_BASE_URL = 'https://api.unsplash.com';

export class UnsplashService {
  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || UNSPLASH_ACCESS_KEY;
  }

  private isValidApiKey(): boolean {
    return Boolean(this.apiKey && this.apiKey !== 'demo-access-key' && this.apiKey !== 'YOUR_UNSPLASH_ACCESS_KEY');
  }

  /**
   * Get demo photos when API key is not available
   */
  private getDemoPhotos(query: string): UnsplashSearchResponse {
    // Return different photos based on search query
    const allPhotos = this.getAllDemoPhotos();
    const queryLower = query.toLowerCase();
    
    let filteredPhotos = allPhotos;
    
    // Filter photos based on search query
    if (queryLower.includes('vineyard')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('vineyard') || p.alt_description?.toLowerCase().includes('vineyard'));
    } else if (queryLower.includes('glass')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('glass') || p.alt_description?.toLowerCase().includes('glass'));
    } else if (queryLower.includes('bottle')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('bottle') || p.alt_description?.toLowerCase().includes('bottle'));
    } else if (queryLower.includes('cellar')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('cellar') || p.alt_description?.toLowerCase().includes('cellar'));
    } else if (queryLower.includes('grapes')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('grapes') || p.alt_description?.toLowerCase().includes('grapes'));
    } else if (queryLower.includes('tasting')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('tasting') || p.alt_description?.toLowerCase().includes('tasting'));
    } else if (queryLower.includes('sommelier')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('sommelier') || p.alt_description?.toLowerCase().includes('sommelier'));
    } else if (queryLower.includes('champagne')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('champagne') || p.alt_description?.toLowerCase().includes('champagne'));
    } else if (queryLower.includes('bar')) {
      filteredPhotos = allPhotos.filter(p => p.description?.toLowerCase().includes('bar') || p.alt_description?.toLowerCase().includes('bar'));
    }
    
    // If no specific matches, return all photos
    if (filteredPhotos.length === 0) {
      filteredPhotos = allPhotos;
    }
    
    return {
      results: filteredPhotos,
      total: filteredPhotos.length,
      total_pages: 1,
    };
  }

  /**
   * Get all demo photos
   */
  private getAllDemoPhotos(): UnsplashPhoto[] {
    const demoPhotos: UnsplashPhoto[] = [
      {
        id: 'demo-wine-1',
        urls: {
          raw: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          full: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          regular: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Photo Demo', username: 'demo' },
        description: 'Wine bottles in cellar',
        alt_description: 'Wine bottles stored in wine cellar',
        width: 2070,
        height: 1380,
        likes: 156,
      },
      {
        id: 'demo-wine-2',
        urls: {
          raw: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2787&q=80',
          full: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2787&q=80',
          regular: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1547595628-c61a29f496f0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Vineyard Demo', username: 'demo' },
        description: 'Vineyard landscape',
        alt_description: 'Rolling hills of vineyard during golden hour',
        width: 2787,
        height: 1858,
        likes: 234,
      },
      {
        id: 'demo-wine-3',
        urls: {
          raw: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80',
          full: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80',
          regular: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1568213816046-0ee1c42bd559?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Glass Demo', username: 'demo' },
        description: 'Wine glass with red wine',
        alt_description: 'Red wine in glass against dark background',
        width: 2574,
        height: 1716,
        likes: 189,
      },
      {
        id: 'demo-wine-4',
        urls: {
          raw: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Grapes Demo', username: 'demo' },
        description: 'Fresh grapes on vine',
        alt_description: 'Purple grapes hanging on vine ready for harvest',
        width: 2940,
        height: 1960,
        likes: 298,
      },
      {
        id: 'demo-wine-5',
        urls: {
          raw: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2061&q=80',
          full: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2061&q=80',
          regular: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1474722883778-792e7990302f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Cheese & Wine Demo', username: 'demo' },
        description: 'Wine and cheese pairing',
        alt_description: 'Wine glass with cheese and crackers on wooden board',
        width: 2061,
        height: 1374,
        likes: 167,
      },
      {
        id: 'demo-wine-6',
        urls: {
          raw: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1437418747212-8d9709afab22?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Tasting Demo', username: 'demo' },
        description: 'Wine tasting setup',
        alt_description: 'Multiple wine glasses for tasting on wooden table',
        width: 2940,
        height: 1960,
        likes: 203,
      },
      {
        id: 'demo-wine-7',
        urls: {
          raw: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Elegant Wine Demo', username: 'demo' },
        description: 'Elegant wine presentation',
        alt_description: 'Wine bottle and glass on marble surface',
        width: 2940,
        height: 1960,
        likes: 312,
      },
      {
        id: 'demo-wine-8',
        urls: {
          raw: 'https://images.unsplash.com/photo-1515779689357-8b2b205287ad?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1515779689357-8b2b205287ad?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1515779689357-8b2b205287ad?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1515779689357-8b2b205287ad?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1515779689357-8b2b205287ad?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Vintage Wine Demo', username: 'demo' },
        description: 'Vintage wine collection',
        alt_description: 'Old wine bottles in cellar with vintage labels',
        width: 2940,
        height: 1960,
        likes: 456,
      },
      {
        id: 'demo-wine-9',
        urls: {
          raw: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2060&q=80',
          full: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2060&q=80',
          regular: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Sommelier Demo', username: 'demo' },
        description: 'Professional sommelier',
        alt_description: 'Sommelier examining wine glass in professional setting',
        width: 2060,
        height: 1373,
        likes: 178,
      },
      {
        id: 'demo-wine-10',
        urls: {
          raw: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          full: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          regular: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Cellar Demo', username: 'demo' },
        description: 'Wine cellar storage',
        alt_description: 'Wine bottles stored in traditional cellar racks',
        width: 2070,
        height: 1380,
        likes: 345,
      },
      {
        id: 'demo-wine-11',
        urls: {
          raw: 'https://images.unsplash.com/photo-1596142332133-327e2a0bd5f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          full: 'https://images.unsplash.com/photo-1596142332133-327e2a0bd5f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80',
          regular: 'https://images.unsplash.com/photo-1596142332133-327e2a0bd5f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1596142332133-327e2a0bd5f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1596142332133-327e2a0bd5f5?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Bottle Demo', username: 'demo' },
        description: 'Wine bottle presentation',
        alt_description: 'Elegant wine bottle with cork and glass on wooden table',
        width: 2070,
        height: 1380,
        likes: 267,
      },
      {
        id: 'demo-wine-12',
        urls: {
          raw: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2126&q=80',
          full: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2126&q=80',
          regular: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Vineyard Workers Demo', username: 'demo' },
        description: 'Vineyard harvest',
        alt_description: 'Workers harvesting grapes in vineyard during autumn',
        width: 2126,
        height: 1417,
        likes: 189,
      },
      {
        id: 'demo-wine-13',
        urls: {
          raw: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1551538827-9c037cb4f32a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Champagne Demo', username: 'demo' },
        description: 'Champagne celebration',
        alt_description: 'Champagne bottle with bubbles and elegant glasses',
        width: 2940,
        height: 1960,
        likes: 412,
      },
      {
        id: 'demo-wine-14',
        urls: {
          raw: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1586370434639-0fe43b2d32d6?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Bar Demo', username: 'demo' },
        description: 'Wine bar atmosphere',
        alt_description: 'Cozy wine bar with bottles and warm lighting',
        width: 2940,
        height: 1960,
        likes: 298,
      },
      {
        id: 'demo-wine-15',
        urls: {
          raw: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Rose Wine Demo', username: 'demo' },
        description: 'Rose wine glass',
        alt_description: 'Elegant rose wine glass with pink wine',
        width: 2940,
        height: 1960,
        likes: 234,
      },
      {
        id: 'demo-wine-16',
        urls: {
          raw: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          full: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2940&q=80',
          regular: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80',
          small: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=400&q=80',
          thumb: 'https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=200&q=80',
        },
        user: { name: 'Wine Dinner Demo', username: 'demo' },
        description: 'Wine dinner setting',
        alt_description: 'Formal wine dinner with multiple glasses and elegant table setting',
        width: 2940,
        height: 1960,
        likes: 387,
      },
    ];

    return demoPhotos;
  }

  /**
   * Search for photos on Unsplash
   */
  async searchPhotos(
    query: string,
    page: number = 1,
    perPage: number = 20
  ): Promise<UnsplashSearchResponse> {
    // Return demo data if no valid API key
    if (!this.isValidApiKey()) {
      return this.getDemoPhotos(query);
    }

    const url = new URL(`${UNSPLASH_BASE_URL}/search/photos`);
    url.searchParams.append('query', query);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('per_page', perPage.toString());
    url.searchParams.append('orientation', 'landscape'); // Better for package covers
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get curated photos (featured photos)
   */
  async getCuratedPhotos(page: number = 1, perPage: number = 20): Promise<UnsplashPhoto[]> {
    // Return demo data if no valid API key
    if (!this.isValidApiKey()) {
      return this.getDemoPhotos('curated').results;
    }

    const url = new URL(`${UNSPLASH_BASE_URL}/photos`);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('per_page', perPage.toString());
    url.searchParams.append('order_by', 'popular');
    
    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Client-ID ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get wine and food related photos
   */
  async getWinePhotos(page: number = 1): Promise<UnsplashPhoto[]> {
    // Return demo data if no valid API key
    if (!this.isValidApiKey()) {
      return this.getDemoPhotos('wine').results;
    }

    const wineQueries = ['wine', 'vineyard', 'wine tasting', 'wine glass', 'wine bottle', 'sommelier'];
    const randomQuery = wineQueries[Math.floor(Math.random() * wineQueries.length)];
    
    const searchResult = await this.searchPhotos(randomQuery, page, 20);
    return searchResult.results;
  }

  /**
   * Download trigger for Unsplash (required by their API terms)
   */
  async triggerDownload(photoId: string): Promise<void> {
    const url = `${UNSPLASH_BASE_URL}/photos/${photoId}/download`;
    
    try {
      await fetch(url, {
        headers: {
          'Authorization': `Client-ID ${this.apiKey}`,
        },
      });
    } catch (error) {
      console.warn('Failed to trigger Unsplash download:', error);
    }
  }
}

// Create a singleton instance
export const unsplash = new UnsplashService();

// Wine-related search suggestions
export const wineSearchSuggestions = [
  'wine',
  'vineyard',
  'wine tasting',
  'wine glass',
  'wine bottle',
  'sommelier',
  'wine cellar',
  'grapes',
  'champagne',
  'wine bar',
  'wine dinner',
  'red wine',
  'white wine',
  'rose wine'
];