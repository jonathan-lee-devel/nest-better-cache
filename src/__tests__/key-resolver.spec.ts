import { compileKeyTemplate, extractParamNames } from '../key-resolver';

describe('extractParamNames', () => {
  it('extracts parameter names from a class method', () => {
    class Svc {
      method(id: string, limit: number) {
        return [id, limit];
      }
    }
    expect(extractParamNames(Svc.prototype.method)).toEqual(['id', 'limit']);
  });

  it('extracts parameter names from an async class method', () => {
    class Svc {
      async method(orgId: string) {
        return orgId;
      }
    }
    expect(extractParamNames(Svc.prototype.method)).toEqual(['orgId']);
  });

  it('returns an empty array when the method has no parameters', () => {
    class Svc {
      method() {
        return null;
      }
    }
    expect(extractParamNames(Svc.prototype.method)).toEqual([]);
  });

  it('skips destructured parameters', () => {
    const fn = (id: string, { limit }: { limit: number }) => [id, limit];
    expect(extractParamNames(fn)).toEqual(['id']);
  });

  it('strips default values and rest spread', () => {
    const fn = (id = 'x', ...rest: string[]) => [id, rest];
    expect(extractParamNames(fn)).toEqual(['id', 'rest']);
  });
});

describe('compileKeyTemplate', () => {
  it('substitutes a single placeholder', () => {
    const resolve = compileKeyTemplate('product.getById.v1.{id}', ['id']);
    expect(resolve(['42'])).toBe('product.getById.v1.42');
  });

  it('substitutes multiple placeholders', () => {
    const resolve = compileKeyTemplate('search.v1.{q}.{page}', ['q', 'page']);
    expect(resolve(['shoes', 2])).toBe('search.v1.shoes.2');
  });

  it('returns the template unchanged when there are no placeholders', () => {
    const resolve = compileKeyTemplate('organizations.v1.list', []);
    expect(resolve([])).toBe('organizations.v1.list');
  });

  it('throws at compile time when a placeholder names no parameter', () => {
    expect(() => compileKeyTemplate('product.{nope}', ['id'])).toThrow(
      /does not match any method parameter/,
    );
  });

  it('throws at runtime when a placeholder argument is null/undefined', () => {
    const resolve = compileKeyTemplate('product.{id}', ['id']);
    expect(() => resolve([undefined])).toThrow(/placeholder "\{id\}" received undefined/);
    expect(() => resolve([null])).toThrow(/received null/);
  });

  it('throws when a placeholder argument is non-primitive', () => {
    const resolve = compileKeyTemplate('product.{id}', ['id']);
    expect(() => resolve([{ nested: 'object' }])).toThrow(
      /must be a string, number, boolean, or bigint/,
    );
  });

  it('reads nested object properties via dot notation', () => {
    const resolve = compileKeyTemplate(
      'products.{organizationId}.{query.categoryId}.{user.requestingUserSubject}',
      ['organizationId', 'user', 'query'],
    );
    const args = ['org-1', { requestingUserSubject: 'sub-9' }, { categoryId: 'cat-3' }];
    expect(resolve(args)).toBe('products.org-1.cat-3.sub-9');
  });

  it('walks multiple levels of dot notation', () => {
    const resolve = compileKeyTemplate('user.{user.profile.id}', ['user']);
    expect(resolve([{ profile: { id: 'abc' } }])).toBe('user.abc');
  });

  it('throws at runtime when the dot path traverses null/undefined', () => {
    const resolve = compileKeyTemplate('q.{query.page}', ['query']);
    expect(() => resolve([undefined])).toThrow(/placeholder "\{query.page\}" received undefined/);
    expect(() => resolve([{ page: null }])).toThrow(/received null/);
  });

  it('throws when the dot path tries to read a property off a primitive', () => {
    const resolve = compileKeyTemplate('q.{query.page}', ['query']);
    expect(() => resolve(['oops'])).toThrow(/cannot read "page" on string/);
  });

  it('throws at compile time when the head of a dot path names no parameter', () => {
    expect(() => compileKeyTemplate('q.{nope.page}', ['query'])).toThrow(
      /does not match any method parameter/,
    );
  });
});
