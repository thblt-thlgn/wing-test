import { readFileSync } from 'fs';
import { join } from 'path';

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
    // items: [],
    items: cursor.items.map(({ item_id, quantity }) => ({
      item: findItemById(item_id, items),
      quantity: parseInt(quantity, 10),
    })),
  }));
};

const items = getItems();
const orders = getOrders(items);

console.log('Items', items);
console.log('Orders', orders);
