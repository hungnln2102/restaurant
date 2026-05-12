import { listStockProducts as listStockProductsFromRepository } from "../repositories/stockProductRepository.mjs";

export async function listStockProducts() {
  return listStockProductsFromRepository();
}
