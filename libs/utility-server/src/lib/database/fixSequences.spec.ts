import { fixSequences } from './fixSequences';
import { DockerizedPostgres } from '@startuphafen/dockerized-node-libs';

jest.setTimeout(60000);

const postgres = new DockerizedPostgres();

describe('fixSequences', () => {
  beforeAll(async () => {
    await postgres.start();
  });

  beforeEach(async () => {
    await postgres.clearDatabase();
    await postgres.knex.raw(
      `create table test_table_1 (id serial primary key, name text)`
    );
    await postgres.knex.raw(
      `create table test_table_2 (id serial primary key, name text)`
    );
    await postgres.knex.raw(
      `create table test_table_3 (id serial primary key, name text)`
    );
  });

  afterAll(async () => {
    await postgres.stop();
  });

  it('should set the sequences to the max id + random number', async () => {
    await postgres.knex('test_table_1').insert({ id: 5, name: 'test1' });
    await postgres.knex('test_table_2').insert({ id: 5, name: 'test2' });
    await postgres.knex('test_table_3').insert({ id: 5, name: 'test3' });

    await fixSequences(postgres.knex);

    const r1 = await postgres
      .knex('test_table_1')
      .insert({ name: 'next1' })
      .returning('id');
    const r2 = await postgres
      .knex('test_table_2')
      .insert({ name: 'next2' })
      .returning('id');
    const r3 = await postgres
      .knex('test_table_3')
      .insert({ name: 'next3' })
      .returning('id');

    const xSet = new Set([r1[0].id, r2[0].id, r3[0].id]);
    console.log(xSet);

    expect(r1[0].id).toBeGreaterThan(6);
    expect(r2[0].id).toBeGreaterThan(6);
    expect(r3[0].id).toBeGreaterThan(6);

    // This test has a chance of ~ 1/(10000^3) to fail due to bad luck
    expect(xSet.size).toBeGreaterThan(1);
  });
});
