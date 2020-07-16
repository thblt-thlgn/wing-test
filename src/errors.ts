import { PARCEL_MAX_WEIGHT } from './environment';
import { Parcel } from './typing';

export class OverWeightedParcelError extends Error {
  constructor(parcel: Parcel) {
    super(
      `The parcel ${parcel.trackingId} is exceeding the maximum weight authorized (${parcel.weight} > ${PARCEL_MAX_WEIGHT}kg)`,
    );
  }
}

export class ItemNotFoundError extends Error {
  constructor(id: string) {
    super(`No item not found with the id: ${id}`);
  }
}
