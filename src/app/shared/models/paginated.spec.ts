import type { Paginated } from '@shared/models';

describe('Paginated', () => {
  it('expone data de solo lectura y los metadatos de página', () => {
    expectTypeOf<Paginated<string>['data']>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<Paginated<string>>().toHaveProperty('page').toEqualTypeOf<number>();
    expectTypeOf<Paginated<string>>().toHaveProperty('pageSize').toEqualTypeOf<number>();
    expectTypeOf<Paginated<string>>().toHaveProperty('total').toEqualTypeOf<number>();
    expectTypeOf<Paginated<string>>().toHaveProperty('totalPages').toEqualTypeOf<number>();
  });
});
