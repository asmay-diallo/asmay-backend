// services/geocodingService.js
const axios = require('axios');
const NodeCache = require('node-cache');
const geohash = require('ngeohash');

// Cache en mémoire (TTL: 7 jours = 604800 secondes)
const locationCache = new NodeCache({ 
  stdTTL: 604800, // 7 jours
  checkperiod: 3600, // Vérification toutes les heures
  useClones: false // Pour de meilleures performances
});

class GeocodingService {
  constructor() {
    // Utilisation de Nominatim (OpenStreetMap) - gratuit
    this.nominatimUrl = 'https://nominatim.openstreetmap.org/reverse';
    this.userAgent = 'AsmayApp/1.0'; // À personnaliser
    this.requestQueue = [];
    this.lastRequestTime = 0;
  }

  /**
   * Méthode principale pour obtenir les détails d'une localisation
   * @param {number} lat - Latitude
   * @param {number} lon - Longitude
   * @param {number} precision - Niveau de précision du geohash
   * @returns {Promise<Object>} Détails de la localisation
   */
  async reverseGeocode(lat, lon, precision = 7) {
    // Validation des entrées
    if (!lat || !lon || isNaN(lat) || isNaN(lon)) {
      console.warn('⚠️ Coordonnées invalides:', { lat, lon });
      return this.getFallbackLocation(lat, lon, precision);
    }

    // Arrondir pour éviter les variations minimes (4 décimales ≈ 11 mètres)
    const roundedLat = Math.round(lat * 10000) / 10000;
    const roundedLon = Math.round(lon * 10000) / 10000;
    
    // Clé de cache unique
    const cacheKey = `${roundedLat},${roundedLon}`;
    
    // 1. Vérifier le cache
    const cached = locationCache.get(cacheKey);
    if (cached) {
      console.log(`📍 Cache HIT pour ${cacheKey}`);
      return {
        ...cached,
        fromCache: true
      };
    }

    console.log(`🌍 Cache MISS pour ${cacheKey}, appel API...`);

    // 2. Vérifier si une requête est déjà en cours pour ces coordonnées
    const existingRequest = this.requestQueue.find(
      req => req.key === cacheKey
    );
    
    if (existingRequest) {
      console.log(`⏳ Requête déjà en cours pour ${cacheKey}, attente...`);
      return existingRequest.promise;
    }

    // 3. Créer une nouvelle requête
    const promise = this._makeAPIRequest(roundedLat, roundedLon, precision, cacheKey);
    
    // Ajouter à la file d'attente
    this.requestQueue.push({
      key: cacheKey,
      promise: promise,
      timestamp: Date.now()
    });

    // Nettoyer la file d'attente après résolution
    promise.finally(() => {
      const index = this.requestQueue.findIndex(req => req.key === cacheKey);
      if (index > -1) this.requestQueue.splice(index, 1);
    });

    return promise;
  }

  /**
   * Effectue la requête API avec rate limiting
   * @private
   */
  async _makeAPIRequest(lat, lon, precision, cacheKey) {
    try {
      // Rate limiting pour respecter les politiques de Nominatim (1 req/sec)
      await this._rateLimit();

      const response = await axios.get(this.nominatimUrl, {
        params: {
          format: 'json',
          lat: lat,
          lon: lon,
          zoom: 18, // Niveau de détail maximum
          addressdetails: 1,
          'accept-language': 'fr' // Priorité au français
        },
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'fr'
        },
        timeout: 5000 // 5 secondes max
      });

      // Vérifier si la réponse est valide
      if (!response.data || response.data.error) {
        throw new Error(response.data?.error || 'Réponse invalide');
      }

      // Transformer la réponse
      const location = this._parseResponse(response.data, lat, lon, precision);
      
      // Sauvegarder dans le cache
      locationCache.set(cacheKey, location);
      
      // Sauvegarder aussi par geohash pour les recherches futures
      const geohashKey = geohash.encode(lat, lon, 7);
      locationCache.set(`geohash:${geohashKey}`, location);

      console.log(`✅ API call réussi pour ${cacheKey}`);
      
      return {
        ...location,
        fromCache: false,
        cachedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Erreur API pour ${cacheKey}:`, error.message);
      
      // Fallback: estimation basée sur les coordonnées
      return this.getFallbackLocation(lat, lon, precision);
    }
  }

  /**
   * Rate limiting pour respecter les limites des APIs
   * @private
   */
  async _rateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Nominatim demande 1 requête par seconde maximum
    if (timeSinceLastRequest < 1000) {
      const waitTime = 1000 - timeSinceLastRequest;
      console.log(`⏱️ Rate limiting: attente de ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Parse la réponse de Nominatim
   * @private
   */
  _parseResponse(data, lat, lon, precision) {
    const address = data.address || {};
    
    // Déterminer le niveau de précision basé sur les données disponibles
    let level = 1;
    if (address.road) level = 7;
    else if (address.suburb || address.neighbourhood) level = 6;
    else if (address.city || address.town || address.village) level = 4;
    else if (address.state) level = 3;
    else if (address.country) level = 2;

    // Construire un nom d'affichage court
    let shortName = '';
    if (address.road) {
      shortName = address.road;
    } else if (address.suburb || address.neighbourhood) {
      shortName = address.suburb || address.neighbourhood;
    } else if (address.city || address.town || address.village) {
      shortName = address.city || address.town || address.village;
    } else if (address.state) {
      shortName = address.state;
    } else if (address.country) {
      shortName = address.country;
    } else {
      shortName = `Position ${Math.abs(lat).toFixed(2)}°`;
    }

    return {
      coordinates: { lat, lon },
      geohash: geohash.encode(lat, lon, precision),
      level: level,
      // Nom court pour l'affichage (priorité au lieu-dit)
      shortName: shortName,
      // Adresse complète détaillée
      address: {
        road: address.road || '',
        neighbourhood: address.neighbourhood || address.suburb || '',
        city: address.city || address.town || address.village || '',
        county: address.county || '',
        state: address.state || '',
        country: address.country || '',
        postcode: address.postcode || '',
        countryCode: address.country_code?.toUpperCase() || ''
      },
      // Nom complet (long)
      displayName: data.display_name || '',
      // Type de lieu (restaurant, école, etc.)
      type: data.type || '',
      // Pour le debug en développement
      raw: process.env.NODE_ENV === 'development' ? data : undefined
    };
  }

  /**
   * Fallback quand l'API échoue
   */
  getFallbackLocation(lat, lon, precision) {
    const hemisphereLat = lat >= 0 ? 'Nord' : 'Sud';
    const hemisphereLon = lon >= 0 ? 'Est' : 'Ouest';
    
    return {
      coordinates: { lat, lon },
      geohash: geohash.encode(lat, lon, precision),
      level: Math.min(precision, 2),
      shortName: `${Math.abs(lat).toFixed(2)}° ${hemisphereLat}`,
      address: {
        country: `Région ${hemisphereLat}`,
        fallback: true
      },
      displayName: `${Math.abs(lat).toFixed(4)}° ${hemisphereLat}, ${Math.abs(lon).toFixed(4)}° ${hemisphereLon}`,
      fromCache: false,
      fallback: true
    };
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats() {
    return {
      keys: locationCache.keys().length,
      hits: locationCache.getStats().hits,
      misses: locationCache.getStats().misses,
      hitRate: locationCache.getStats().hits / 
        (locationCache.getStats().hits + locationCache.getStats().misses || 1)
    };
  }

  /**
   * Vider le cache (utile pour le debug)
   */
  clearCache() {
    locationCache.flushAll();
    console.log('🗑️ Cache vidé');
  }

  /**
   * Précharger des zones populaires
   */
  async preloadPopularLocations() {
    const popularSpots = [
      { name: 'Bamako', lat: 12.6392, lon: -8.0029 },
      { name: 'Paris', lat: 48.8566, lon: 2.3522 },
      { name: 'Dakar', lat: 14.7167, lon: -17.4677 },
      { name: 'Abidjan', lat: 5.3599, lon: -4.0083 },
      { name: 'New York', lat: 40.7128, lon: -74.0060 }
    ];

    console.log('🚀 Préchargement des zones populaires...');
    
    for (const spot of popularSpots) {
      await this.reverseGeocode(spot.lat, spot.lon, 7);
      // Petit délai entre chaque requête
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
    
    console.log('✅ Préchargement terminé');
  }
}

// Exporter une instance unique (singleton)
module.exports = new GeocodingService();