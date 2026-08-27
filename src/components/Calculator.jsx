import { useEffect, useRef, useState } from 'react';
import './Calculator.css';

/**
 * Safe arithmetic evaluator.
 *
 * Why not `Function('"use strict"; return (' + expr + ')')()`?
 * Because in strict-mode JS, a numeric literal with a leading zero
 * followed by more digits (e.g. "05") is parsed as a legacy octal
 * literal, which is a SyntaxError in strict mode. So "5*05" would
 * throw before any math ever ran. Using our own tokenizer/parser
 * sidesteps that entirely (and avoids eval-like code execution).
 *
 * Supports: + - * / . and unary minus, with normal precedence
 * (* and / bind tighter than + and -).
 */
function evaluateExpression(input) {
  const expr = input.trim();
  if (!expr) return 0;

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];

    if (ch === ' ') {
      i++;
      continue;
    }

    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      if ((num.match(/\./g) || []).length > 1) {
        throw new Error('Invalid number: ' + num);
      }
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }

    throw new Error('Unexpected character: ' + ch);
  }

  if (tokens.length === 0) return 0;

  // Insert implicit 0 for leading unary +/- (e.g. "-5+3")
  if (tokens[0].type === 'op' && (tokens[0].value === '+' || tokens[0].value === '-')) {
    tokens.unshift({ type: 'num', value: 0 });
  }

  // Collapse consecutive operators into a single signed operator
  // (handles unary minus after another operator, e.g. "5*-5")
  const collapsed = [];
  for (const t of tokens) {
    if (
      t.type === 'op' &&
      collapsed.length > 0 &&
      collapsed[collapsed.length - 1].type === 'op'
    ) {
      const prev = collapsed.pop();
      // Combine sign: only meaningful for +/- chains before a number
      const sign = prev.value === '-' ? (t.value === '-' ? '+' : '-') : t.value;
      collapsed.push({ type: 'op', value: sign });
    } else {
      collapsed.push(t);
    }
  }

  // Validate alternating num/op pattern
  for (let idx = 0; idx < collapsed.length; idx++) {
    const expectType = idx % 2 === 0 ? 'num' : 'op';
    if (collapsed[idx].type !== expectType) {
      throw new Error('Malformed expression');
    }
  }
  if (collapsed.length % 2 === 0) {
    throw new Error('Expression ends with an operator');
  }

  // Pass 1: resolve * and /
  const passOne = [collapsed[0]];
  for (let idx = 1; idx < collapsed.length; idx += 2) {
    const op = collapsed[idx];
    const nextNum = collapsed[idx + 1];

    if (op.value === '*' || op.value === '/') {
      const prev = passOne.pop();
      if (op.value === '/' && nextNum.value === 0) {
        throw new Error('Division by zero');
      }
      const result =
        op.value === '*' ? prev.value * nextNum.value : prev.value / nextNum.value;
      passOne.push({ type: 'num', value: result });
    } else {
      passOne.push(op, nextNum);
    }
  }

  // Pass 2: resolve + and -
  let result = passOne[0].value;
  for (let idx = 1; idx < passOne.length; idx += 2) {
    const op = passOne[idx];
    const num = passOne[idx + 1];
    result = op.value === '+' ? result + num.value : result - num.value;
  }

  if (!Number.isFinite(result)) {
    throw new Error('Result is not a finite number');
  }

  return result;
}

export default function Calculator({ onClose, className = '' }) {
  const [expr, setExpr] = useState('');
  const calcRef = useRef(null);

  const press = (val) => setExpr((e) => e + val);
  const clear = () => setExpr('');
  const backspace = () => setExpr((e) => e.slice(0, -1));

  const evaluate = () => {
    if (!expr.trim()) {
      setExpr('0');
      return;
    }

    try {
      const result = evaluateExpression(expr);
      // Trim floating point noise (e.g. 0.1 + 0.2) without losing precision unnecessarily
      const rounded = Math.round(result * 1e10) / 1e10;
      setExpr(String(rounded));
    } catch {
      setExpr('Error');
    }
  };

  // Close calculator when clicking anywhere outside it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calcRef.current && !calcRef.current.contains(event.target)) {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Keyboard input support
  useEffect(() => {
    const handleKeyDown = (event) => {
      const { key } = event;

      if (/^[0-9.]$/.test(key)) {
        press(key);
        return;
      }

      if (['+', '-', '*', '/'].includes(key)) {
        press(key);
        return;
      }

      if (key === 'Enter' || key === '=') {
        event.preventDefault();
        evaluate();
        return;
      }

      if (key === 'Backspace') {
        backspace();
        return;
      }

      if (key === 'Escape') {
        onClose?.();
      }

      if (key === 'Delete' || key.toLowerCase() === 'c') {
        clear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [expr, onClose]);

  const keys = [
    '7', '8', '9', '/',
    '4', '5', '6', '*',
    '1', '2', '3', '-',
    '0', '.', '=', '+',
  ];

  return (
    <div
      ref={calcRef}
      className={`calc-panel ${className}`}
    >
      <div className="calc-display">{expr || '0'}</div>

      <div className="calc-grid">
        {keys.map((k) =>
          k === '=' ? (
            <button
              key={k}
              className="calc-key calc-key-eq"
              onClick={evaluate}
            >
              {k}
            </button>
          ) : (
            <button
              key={k}
              className="calc-key"
              onClick={() => press(k)}
            >
              {k}
            </button>
          )
        )}
      </div>

      <div className="calc-actions">
        <button
          className="btn btn-secondary btn-sm"
          onClick={backspace}
        >
          ⌫
        </button>

        <button
          className="btn btn-secondary btn-sm"
          onClick={clear}
        >
          Clear
        </button>

        <button
          className="btn btn-ghost btn-sm"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}