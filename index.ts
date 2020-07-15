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
  constructor(public order: Order, public paletteId: number, public trackingId: string) {}

  get items(): Item[] {
    return this.order.items.reduce(
      (acc, cursor) => [
        ...acc,
        ...Array.from(new Array(cursor.quantity)).map(() => cursor.item),
      ],
      new Array<Item>(),
    );
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

    return 10;
  }
}

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

const generateParcels = async (
  orders: Order[],
  maxParcelPerPalette = 15,
): Promise<Parcel[]> => {
  const promises = orders.map(async (order, position) => {
    const trackingId = await getTrackingCode();
    const paletteId = Math.floor(position / maxParcelPerPalette) + 1;
    return new Parcel(order, paletteId, trackingId);
  });

  return Promise.all(promises);
};

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
