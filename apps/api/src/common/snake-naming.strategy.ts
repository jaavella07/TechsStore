import { DefaultNamingStrategy, NamingStrategyInterface } from 'typeorm';

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  private toSnake(name: string): string {
    return name.replace(/([A-Z])/g, (l) => `_${l.toLowerCase()}`);
  }

  override tableName(className: string, customName: string): string {
    return customName || this.toSnake(className);
  }

  override columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    const base = customName || this.toSnake(propertyName);
    return embeddedPrefixes.length
      ? this.toSnake(embeddedPrefixes.join('_')) + '_' + base
      : base;
  }

  override relationName(propertyName: string): string {
    return this.toSnake(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return this.toSnake(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(firstTableName: string, secondTableName: string): string {
    return this.toSnake(`${firstTableName}_${secondTableName}`);
  }

  override joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return this.toSnake(`${tableName}_${columnName || propertyName}`);
  }
}
