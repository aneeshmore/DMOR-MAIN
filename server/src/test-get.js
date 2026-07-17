import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { MasterProductsRepository } from './modules/master-products/repository.js';
import { MasterProductDTO } from './modules/master-products/dto.js';

async function test() {
  try {
    const repo = new MasterProductsRepository();
    const result = await repo.findAllMasterProducts();
    console.log('Query succeeded. Count:', result.length);
    const dtos = result.map(mp => new MasterProductDTO(mp));
    console.log('DTO mapping succeeded');
  } catch (error) {
    console.error('ERROR:', error);
  }
  process.exit(0);
}

test();
