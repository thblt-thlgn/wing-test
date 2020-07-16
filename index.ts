import { readFileSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const ITEMS_FILE_PATH = join(__dirname, './data/items.json');
const ORDERS_FILE_PATH = join(__dirname, './data/orders.json');

interface DataItems {
  items: {
    id: string;
    name: string;
    weight: string;
  }[];
}

interface DataOrders {
  orders: {
    id: string;
    date: string;
    items: {
      item_id: string;
      quantity: string;
    }[];
  }[];
}

interface Item {
  id: string;
  name: string;
  weight: number;
}

interface Order {
  id: string;
  date: Date;
  items: {
    item: Item;
    quantity: number;
  }[];
}

class Parcel {
  #items: Item[] = [];

  constructor(public order: Order, public paletteId: number, public trackingId: string) {}

  get items(): Item[] {
    return this.#items;
  }

  get weight(): number {
    return this.items.reduce((acc, item) => acc + item.weight, 0);
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
      throw new Error(
        `The parcel ${this.trackingId} is exceeding the maximum weight authorized (${this.weight} > 30kg)`,
      );
    }

    return 10;
  }

  get isOverWeighted(): boolean {
    return isOverWeighted(this.weight);
  }

  addItem(item: Item): boolean {
    if (isOverWeighted(this.weight + item.weight)) {
      return false;
    }

    this.#items.push(item);
    console.log(this.trackingId, this.weight);
    return true;
  }
}

const isOverWeighted = (weight: number) => weight > 30;

const getItems = (): Item[] => {
  const items = readFileSync(ITEMS_FILE_PATH);
  const dataItems = JSON.parse(items.toString()) as DataItems;
  return dataItems.items.map((cursor) => ({
    ...cursor,
    weight: parseFloat(cursor.weight),
  }));
};

const findItemById = (id: Item['id'], items: Item[]): Item => {
  const item = items.find((cursor) => cursor.id === id);
  if (!item) {
    throw new Error(`No item not found with the id: ${id}`);
  }
  return item;
};

const getOrders = (items: Item[]): Order[] => {
  const orders = readFileSync(ORDERS_FILE_PATH);
  const dataOrders = JSON.parse(orders.toString()) as DataOrders;
  return dataOrders.orders.map((cursor) => ({
    id: cursor.id,
    date: new Date(cursor.date),
    items: cursor.items.map(({ item_id, quantity }) => ({
      item: findItemById(item_id, items),
      quantity: parseInt(quantity, 10),
    })),
  }));
};

const getTrackingCode = async (): Promise<string> => {
  const res = await axios.post('https://helloacm.com/api/random/?n=15');
  return res.data;
};

const generateParcelItems = (order: Order): Item[] =>
  order.items.reduce(
    (acc, cursor) => [
      ...acc,
      ...Array.from(new Array(cursor.quantity)).map(() => cursor.item),
    ],
    new Array<Item>(),
  );

const generateParcels = async (
  orders: Order[],
  maxParcelPerPalette = 15,
): Promise<Parcel[]> =>
  orders.reduce(async (acc, order, position) => {
    const list = await acc;
    const items = generateParcelItems(order);
    let parcel = new Parcel(
      order,
      Math.floor(position / maxParcelPerPalette) + 1,
      await getTrackingCode(),
    );
    const parcels = [parcel];

    for (const item of items) {
      if (isOverWeighted(parcel.weight + item.weight)) {
        parcel = new Parcel(
          order,
          Math.floor(position / maxParcelPerPalette) + 1,
          await getTrackingCode(),
        );
        parcels.push(parcel);
      }

      parcel.addItem(item);
    }

    return [...list, ...parcels];
  }, Promise.resolve(new Array<Parcel>()));

const computeTotalAmount = (parcels: Parcel[]): number =>
  parcels.reduce((acc, parcel) => acc + parcel.cost, 0);

const main = async () => {
  const items = getItems();
  const orders = getOrders(items);
  const parcels = await generateParcels(orders);
  const totalAmount = computeTotalAmount(parcels);
  console.log(totalAmount);
};

main();
