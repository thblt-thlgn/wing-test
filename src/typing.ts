import { getItemGroupWeight, isOverWeighted } from './utils';
import { OverWeightedParcelError } from './errors';

export interface DataItems {
  items: {
    id: string;
    name: string;
    weight: string;
  }[];
}

export interface DataOrders {
  orders: {
    id: string;
    date: string;
    items: {
      item_id: string;
      quantity: string;
    }[];
  }[];
}

export interface Item {
  id: string;
  name: string;
  weight: number;
}

export interface Order {
  id: string;
  date: Date;
  items: {
    item: Item;
    quantity: number;
  }[];
}

export class Parcel {
  constructor(
    public order: Order,
    public paletteId: number,
    public trackingId: string,
    public items: Item[],
  ) {}

  get weight(): number {
    return getItemGroupWeight(this.items);
  }

  get cost(): number {
    if (this.weight <= 1) {
      return 1;
    }

    if (this.weight <= 5) {
      return 2;
    }

    if (this.weight <= 10) {
      return 3;
    }

    if (this.weight <= 20) {
      return 5;
    }

    if (this.isOverWeighted) {
      throw new OverWeightedParcelError(this);
    }

    return 10;
  }

  get isOverWeighted(): boolean {
    return isOverWeighted(this.weight);
  }
}
