declare namespace google.maps.places {
  class Autocomplete extends google.maps.MVCObject {
    constructor(
      inputField: HTMLInputElement,
      opts?: AutocompleteOptions,
    );
    addListener(eventName: "place_changed", handler: () => void): google.maps.MapsEventListener;
    getPlace(): PlaceResult;
  }

  class AutocompleteService {
    getPlacePredictions(
      request: AutocompletionRequest,
      callback: (
        predictions: AutocompletePrediction[] | null,
        status: string,
      ) => void,
    ): void;
  }

  interface AutocompletionRequest {
    input: string;
    componentRestrictions?: ComponentRestrictions;
  }

  interface AutocompletePrediction {
    description?: string;
    place_id?: string;
  }

  interface AutocompleteOptions {
    bounds?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral;
    componentRestrictions?: ComponentRestrictions;
    fields?: string[];
    types?: string[];
  }

  interface ComponentRestrictions {
    country?: string | string[];
  }

  interface AddressComponent {
    long_name?: string;
    short_name?: string;
    types?: string[];
  }

  interface PlaceResult {
    formatted_address?: string;
    address_components?: AddressComponent[];
    geometry?: {
      location?: google.maps.LatLng;
    };
    name?: string;
    place_id?: string;
  }
}

declare namespace google.maps {
  class LatLng {
    lat(): number;
    lng(): number;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface MapsEventListener {
    remove(): void;
  }

  class MVCObject {
    addListener(eventName: string, handler: () => void): MapsEventListener;
  }

  interface MapOptions {
    center?: LatLng | LatLngLiteral;
    zoom?: number;
    disableDefaultUI?: boolean;
    zoomControl?: boolean;
    gestureHandling?: "cooperative" | "greedy" | "none" | "auto";
    clickableIcons?: boolean;
  }

  class Map extends MVCObject {
    constructor(mapDiv: HTMLElement, opts?: MapOptions);
    getCenter(): LatLng | undefined;
    setCenter(latLng: LatLng | LatLngLiteral): void;
    getZoom(): number | undefined;
    setZoom(zoom: number): void;
  }

  interface GeocoderAddressComponent {
    long_name?: string;
    short_name?: string;
    types?: string[];
  }

  interface GeocoderResult {
    formatted_address?: string;
    address_components?: GeocoderAddressComponent[];
    place_id?: string;
    types?: string[];
  }

  interface GeocoderResponse {
    results: GeocoderResult[];
  }

  interface GeocoderRequest {
    location?: LatLng | LatLngLiteral;
  }

  class Geocoder {
    geocode(request: GeocoderRequest): Promise<GeocoderResponse>;
  }
}

declare const google: {
  maps: {
    places: typeof google.maps.places;
    Map: typeof google.maps.Map;
    Geocoder: typeof google.maps.Geocoder;
  };
};

interface Window {
  google?: typeof google;
}
