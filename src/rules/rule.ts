import { JsonPath } from '@stoplight/types/dist';
import { IRunRule, SpectralDiagnosticSeverity } from '../types';
import { shouldBailOut } from './utils';

const { JSONPath } = require('jsonpath-plus');

export class Rule implements IRunRule {
  public readonly name: string;
  public readonly severity: SpectralDiagnosticSeverity;
  public readonly formats?: string[];

  private readonly query: JsonPath;
  private _bailedOut = false;
  public finished = false;

  constructor(_rule: IRunRule) {
    this.name = _rule.name;
    this.severity = _rule.severity;
    this.formats = _rule.formats;
    this.query = JSONPath.toPathArray(_rule.given);
    this._bailedOut = shouldBailOut(this.query);
  }

  private _end() {
    this.finished = true;
    this.query.length = 0;
  }

  // this is to be sliced into smaller chunk, just trying things out
  private _tryReducing(value: unknown) {
    this.query.shift();

    while (this.query.length > 0) {
      const segment = String(this.query[0]);
      if (segment.length === 0) {
        // very unlikely to be ever empty, but you never know
        this.query.shift();
        continue;
      }

      if (segment[0] === '?') {
        // todo: let's have it sandboxed
        const result = Function('__curObj', `return (${segment.slice(1).replace('@', '__curObj')})`)(value);
        if (result) {
          this.query.shift();
        } else {
          this._end();
        }
      } else {
        return false;
      }
    }

    return true;
  }

  public tick(path: JsonPath, key: string, value: unknown) {
    if (this._bailedOut) {
      // this.run();
      // regular jsonpath-based query
      this.finished = true;
      return;
    }

    if (this.query[0] === key) {
      // todo: next tick should fail if no match, ya know, perhaps store level on tick
      const shouldCall = this._tryReducing(value);

      if (shouldCall) {
        this._run(path.slice(), value);
      }
    }
  }
}
