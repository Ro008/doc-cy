declare namespace google.maps.places {
  class Autocomplete extends google.maps.MVCObject {
    constructor(
      inputField: HTMLInputElement,
      opts?: AutocompleteOptions,
    );
    addListener(eventName: "place_changed", handler: () => void): google.maps.MapsEventListener;
    getPlace(): PlaceResult;
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

  interface MapsEventListener {
    remove(): void;
  }

  class MVCObject {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addListener(eventName: string, handler: () => void): MapsEventListener;
  }
}

declare const google: {
  maps: {
    places: typeof google.maps.places;
  };
};

interface Window {
  google?: typeof google;
}
