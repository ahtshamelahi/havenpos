import { useState, useRef, useEffect } from 'react';
import './LineItemsEditor.css';



// Computes a line's total:
// (qty * unit_price) - discount, then tax is applied according
// to the product's selling_price_tax_type.
export function computeLine(
  item,
  taxRatesById,
  productsById = {},
  overallDiscountRatio = 0
) {
  const qty =
    Number(item.quantity) || 0;

  const unitPrice =
    Number(item.unit_price) || 0;

  const subtotal =
    qty * unitPrice;

  let discount =
    Number(item.discount_amount) || 0;

  if (
    item.discount_type === 'percentage'
  ) {
    discount =
      (subtotal * discount) / 100;
  }

  let net =
    Math.max(
      subtotal - discount,
      0
    );

  if (overallDiscountRatio > 0) {
    net = Math.max(net - (net * overallDiscountRatio), 0);
  }

  const taxRate =
    item.tax_id
      ? Number(
          taxRatesById[item.tax_id]
            ?.rate_percentage || 0
        )
      : 0;

  const product =
    productsById[item.product_id];

  const taxType =
    product?.selling_price_tax_type ||
    'exclusive';

  let taxAmount;
  let lineTotal;

  if (
    taxType === 'inclusive'
  ) {
    taxAmount =
      net -
      net /
        (1 + taxRate / 100);

    lineTotal =
      net;
  } else {
    taxAmount =
      (net * taxRate) / 100;

    lineTotal =
      net + taxAmount;
  }

  return {
    subtotal,
    discount,
    taxAmount,
    lineTotal,
  };
}



/*
 * Calculates unit price after discount.
 */
function calculateUnitPriceBeforeTax(
  unitPriceBeforeDiscount,
  discountType,
  discountAmount
) {
  const price =
    Number(
      unitPriceBeforeDiscount
    ) || 0;

  const discount =
    Number(
      discountAmount
    ) || 0;

  if (
    discountType === 'percentage'
  ) {
    return Math.max(
      price -
        (price * discount) / 100,
      0
    );
  }

  return Math.max(
    price - discount,
    0
  );
}



/*
 * Calculates selling price using profit margin.
 */
function calculateSellingPrice(
  unitPriceBeforeTax,
  profitMargin
) {
  const cost =
    Number(
      unitPriceBeforeTax
    ) || 0;

  const margin =
    Number(
      profitMargin
    ) || 0;

  return (
    cost +
    (cost * margin) / 100
  );
}



/*
 * Calculates profit margin from:
 *
 * Cost price
 * Selling price
 */
function calculateProfitMargin(
  unitPriceBeforeTax,
  sellingPrice
) {
  const cost =
    Number(
      unitPriceBeforeTax
    ) || 0;

  const price =
    Number(
      sellingPrice
    ) || 0;

  if (
    cost <= 0
  ) {
    return 0;
  }

  return (
    ((price - cost) / cost) *
    100
  );
}



/*
 * Sorts products so that names starting with the
 * typed search text come first (A→Z), and every
 * other product follows underneath (also A→Z).
 *
 * Typing more letters ("S" -> "So" -> "Soo") just
 * narrows the top group further; nothing jumps
 * around unexpectedly.
 */
function sortProductsForSearch(
  products,
  searchText
) {
  const sorted =
    [...products].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

  const query =
    searchText.trim().toLowerCase();

  if (!query) {
    return sorted;
  }

  const startsWith = [];
  const rest = [];

  for (const p of sorted) {
    if (
      p.name
        .toLowerCase()
        .startsWith(query)
    ) {
      startsWith.push(p);
    } else {
      rest.push(p);
    }
  }

  return [
    ...startsWith,
    ...rest,
  ];
}



export default function LineItemsEditor({
  items,
  onChange,
  products,
  taxRates,
  priceField,
  stockMap = {},
  mode = 'sale',
}) {
  /*
   * Text typed into the product
   * search box.
   */
  const [
    searchText,
    setSearchText
  ] = useState('');



  const [
    isDropdownOpen,
    setIsDropdownOpen
  ] = useState(false);



  const [
    highlightedIndex,
    setHighlightedIndex
  ] = useState(-1);



  const searchContainerRef =
    useRef(null);



  const isPurchase =
    mode === 'purchase';



  const isSale =
    mode === 'sale';



  /*
   * Close the dropdown when clicking
   * anywhere outside of it.
   */
  useEffect(() => {

    function handleClickOutside(e) {

      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          e.target
        )
      ) {
        setIsDropdownOpen(false);
      }

    }



    document.addEventListener(
      'mousedown',
      handleClickOutside
    );



    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      );

  }, []);



  /*
   * Convert tax rates into:
   *
   * {
   *   taxId: taxObject
   * }
   */
  const taxRatesById =
    Object.fromEntries(
      taxRates.map((t) => [
        t.id,
        t
      ])
    );



  /*
   * Convert products into:
   *
   * {
   *   productId: productObject
   * }
   */
  const productsById =
    Object.fromEntries(
      products.map((p) => [
        p.id,
        p
      ])
    );



  /*
   * Products shown in the search
   * dropdown, ordered so that
   * matches on the typed text
   * float to the top.
   */
  const displayedProducts =
    sortProductsForSearch(
      products,
      searchText
    );



  /*
   * Add product to line items directly.
   *
   * PURCHASE:
   * - All products can be added.
   * - Stock is completely ignored.
   *
   * SALE:
   * - Product must have stock.
   * - Product quantity cannot exceed stock.
   */
  const selectProduct = (product) => {
    /*
     * Stock is only used for Sales.
     *
     * Purchases do not use stock
     * to decide whether a product
     * can be added.
     */
    const availableQty =
      isSale
        ? Number(stockMap[product.id] || 0)
        : null;

    /*
     * Sales require existing stock.
     */
    if (isSale && availableQty <= 0) {
      return;
    }

    const initialPrice = Number(product[priceField]) || 0;

    /*
     * PURCHASE
     */
    if (isPurchase) {
      onChange([
        ...items,
        {
          product_id: product.id,
          quantity: 1,
          /*
           * Purchase price before discount.
           */
          unit_price: initialPrice,
          /*
           * Purchase discount.
           */
          discount_type: 'fixed',
          discount_amount: 0,
          /*
           * Calculated price after
           * discount and before tax.
           */
          unit_price_before_tax: initialPrice,
          /*
           * Default selling price.
           */
          selling_price: Number(product.default_selling_price) || initialPrice,
          /*
           * Default profit margin.
           */
          profit_margin: calculateProfitMargin(initialPrice, Number(product.default_selling_price) || initialPrice),
          tax_id: product.applicable_tax_id || '',
        },
      ]);
    }
    /*
     * SALE
     */
    else {
      onChange([
        ...items,
        {
          product_id: product.id,
          quantity: 1,
          unit_price: initialPrice,
          discount_type: 'fixed',
          discount_amount: 0,
          tax_id: product.applicable_tax_id || '',
        },
      ]);
    }

    setSearchText('');
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  /*
   * Typing invalidates whatever
   * was previously selected, and
   * re-opens/re-filters the dropdown.
   */
  const handleSearchChange = (e) => {
    setSearchText(e.target.value);
    setIsDropdownOpen(true);
    setHighlightedIndex(-1);
  };

  const handleSearchKeyDown = (e) => {
    if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsDropdownOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, displayedProducts.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const product = displayedProducts[highlightedIndex];
      if (product) {
        selectProduct(product);
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  /*
   * Update a line item.
   */
  const updateItem = (
    idx,
    patch
  ) => {
    onChange(
      items.map(
        (it, i) =>
          i === idx
            ? {
                ...it,
                ...patch,
              }
            : it
      )
    );
  };

  /*
   * Remove a line item.
   */
  const removeItem = (
    idx
  ) => {
    onChange(
      items.filter(
        (_, i) =>
          i !== idx
      )
    );
  };

  /*
   * Update purchase price,
   * discount and calculated values.
   */
  const updatePurchasePrice = (
    idx,
    patch
  ) => {
    const currentItem =
      items[idx];

    const nextItem = {
      ...currentItem,
      ...patch,
    };

    const unitPriceBeforeTax =
      calculateUnitPriceBeforeTax(
        nextItem.unit_price,
        nextItem.discount_type,
        nextItem.discount_amount
      );

    const sellingPrice =
      Number(
        nextItem.selling_price
      ) || 0;

    const profitMargin =
      calculateProfitMargin(
        unitPriceBeforeTax,
        sellingPrice
      );

    updateItem(
      idx,
      {
        ...patch,
        unit_price_before_tax:
          Number(
            unitPriceBeforeTax.toFixed(2)
          ),
        profit_margin:
          Number(
            profitMargin.toFixed(2)
          ),
      }
    );
  };

  /*
   * Changing profit margin changes
   * selling price.
   */
  const updateProfitMargin = (
    idx,
    value
  ) => {
    const item =
      items[idx];

    const unitPriceBeforeTax =
      Number(
        item.unit_price_before_tax
      ) || 0;

    const profitMargin =
      Number(
        value
      ) || 0;

    const sellingPrice =
      calculateSellingPrice(
        unitPriceBeforeTax,
        profitMargin
      );

    updateItem(
      idx,
      {
        profit_margin:
          value,
        selling_price:
          Number(
            sellingPrice.toFixed(2)
          ),
      }
    );
  };

  /*
   * Changing selling price changes
   * profit margin.
   */
  const updateSellingPrice = (
    idx,
    value
  ) => {
    const item =
      items[idx];

    const unitPriceBeforeTax =
      Number(
        item.unit_price_before_tax
      ) || 0;

    const sellingPrice =
      Number(
        value
      ) || 0;

    const profitMargin =
      calculateProfitMargin(
        unitPriceBeforeTax,
        sellingPrice
      );

    updateItem(
      idx,
      {
        selling_price:
          value,
        profit_margin:
          Number(
            profitMargin.toFixed(2)
          ),
      }
    );
  };

  return (
    <div className="line-items">
      {/* ADD PRODUCT */}
      <div className="line-items-add">
        <div
          className="product-search"
          ref={searchContainerRef}
        >
          <input
            type="text"
            className="product-search-input"
            placeholder="Search a product to add…"
            value={searchText}
            onChange={
              handleSearchChange
            }
            onFocus={() =>
              setIsDropdownOpen(
                true
              )
            }
            onKeyDown={
              handleSearchKeyDown
            }
          />

          {isDropdownOpen && (
            <div className="product-search-dropdown">
              {displayedProducts.length ===
              0 ? (
                <div className="product-search-empty">
                  No products found.
                </div>
              ) : (
                displayedProducts.map(
                  (p, i) => {
                    const availableQty =
                      Number(
                        stockMap[
                          p.id
                        ] || 0
                      );

                    const isDisabled =
                      isSale &&
                      availableQty <=
                        0;

                    return (
                      <div
                        key={p.id}
                        className={
                          'product-search-item' +
                          (isDisabled
                            ? ' disabled'
                            : '') +
                          (i ===
                          highlightedIndex
                            ? ' highlighted'
                            : '')
                        }
                        onMouseDown={(
                          e
                        ) => {
                          /*
                           * Prevent the input
                           * from losing focus
                           * (and the dropdown
                           * closing) before the
                           * click registers.
                           */
                          e.preventDefault();

                          if (
                            !isDisabled
                          ) {
                            selectProduct(
                              p
                            );
                          }
                        }}
                        onMouseEnter={() =>
                          setHighlightedIndex(
                            i
                          )
                        }
                      >
                        <span className="product-search-item-name">
                          {p.name} ({p.sku})
                        </span>

                        <span className="product-search-item-stock">
                          Stock: {availableQty}
                        </span>
                      </div>
                    );
                  }
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* LINE ITEMS */}
      {items.length === 0 ? (

        <div className="muted line-items-empty">
          No items added yet.
        </div>

      ) : (

        <div className="line-items-table-wrapper">

          <table
            className="data-table line-items-table"
          >

            <thead>

              <tr>

                <th>
                  Product
                </th>



                <th>
                  Qty
                </th>



                <th>
                  Unit price
                  <br />
                  before discount
                </th>



                {isPurchase && (

                  <th>
                    Discount
                  </th>

                )}



                {isPurchase && (

                  <th>
                    Unit price
                    <br />
                    before tax
                  </th>

                )}



                {isPurchase && (

                  <th>
                    Profit margin %
                  </th>

                )}



                {isPurchase && (

                  <th>
                    Default selling price
                  </th>

                )}



                {!isPurchase && (

                  <th>
                    Discount
                  </th>

                )}



                <th>
                  Tax
                </th>



                <th>
                  Line total
                </th>



                <th></th>

              </tr>

            </thead>



            <tbody>

              {items.map(
                (
                  item,
                  idx
                ) => {

                  const {
                    lineTotal
                  } =
                    computeLine(
                      item,
                      taxRatesById,
                      productsById
                    );



                  const product =
                    productsById[
                      item.product_id
                    ];



                  /*
                   * Stock is calculated
                   * only for Sales.
                   */
                  const availableQty =
                    isSale
                      ? Number(
                          stockMap[
                            item.product_id
                          ] || 0
                        )
                      : null;



                  return (

                    <tr
                      key={idx}
                    >

                      <td>

                        {product?.name ||
                          'Unknown product'}



                        {isSale && (

                          <div className="muted">

                            Available:
                            {' '}
                            {availableQty}

                          </div>

                        )}

                      </td>



                      <td>

                        <input
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          className="line-input line-input-sm"
                          value={
                            item.quantity
                          }
                          onChange={(e) => {

                            const value =
                              e.target.value;



                            /*
                             * Allow temporarily
                             * empty input.
                             */
                            if (
                              value === ''
                            ) {

                              updateItem(
                                idx,
                                {
                                  quantity:
                                    ''
                                }
                              );

                              return;

                            }



                            /*
                             * Only positive
                             * whole numbers.
                             */
                            if (
                              !/^[1-9]\d*$/.test(
                                value
                              )
                            ) {
                              return;
                            }



                            /*
                             * Prevent selling
                             * more than available stock.
                             */
                            if (
                              isSale &&
                              Number(value) >
                                availableQty
                            ) {
                              return;
                            }



                            updateItem(
                              idx,
                              {
                                quantity:
                                  Number(
                                    value
                                  ),
                              }
                            );

                          }}
                        />

                      </td>



                      <td>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="line-input line-input-sm"
                          value={
                            item.unit_price
                          }
                          onChange={(e) => {

                            if (
                              isPurchase
                            ) {

                              updatePurchasePrice(
                                idx,
                                {
                                  unit_price:
                                    e.target.value
                                }
                              );

                            } else {

                              updateItem(
                                idx,
                                {
                                  unit_price:
                                    e.target.value
                                }
                              );

                            }

                          }}
                        />

                      </td>



                      {/* PURCHASE DISCOUNT */}

                      {isPurchase && (

                        <td>

                          <select
                            className="line-input line-input-xs"
                            value={
                              item.discount_type
                            }
                            onChange={(e) => {

                              updatePurchasePrice(
                                idx,
                                {
                                  discount_type:
                                    e.target.value
                                }
                              );

                            }}
                          >

                            <option value="fixed">
                              Fixed
                            </option>



                            <option value="percentage">
                              %
                            </option>

                          </select>



                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="line-input line-input-sm"
                            value={
                              item.discount_amount
                            }
                            onChange={(e) => {

                              updatePurchasePrice(
                                idx,
                                {
                                  discount_amount:
                                    e.target.value
                                }
                              );

                            }}
                          />

                        </td>

                      )}



                      {/* UNIT PRICE BEFORE TAX */}

                      {isPurchase && (

                        <td>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="line-input line-input-sm"
                            value={
                              item.unit_price_before_tax
                            }
                            readOnly
                          />

                        </td>

                      )}



                      {/* PROFIT MARGIN */}

                      {isPurchase && (

                        <td>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="line-input line-input-sm"
                            value={
                              item.profit_margin
                            }
                            readOnly
                          />

                        </td>

                      )}



                      {/* SELLING PRICE */}

                      {isPurchase && (

                        <td>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="line-input line-input-sm"
                            value={
                              item.selling_price
                            }
                            readOnly
                          />

                        </td>

                      )}



                      {/* SALE DISCOUNT */}

                      {!isPurchase && (

                        <td
                          className="line-discount-cell"
                        >

                          <select
                            className="line-input line-input-xs"
                            value={
                              item.discount_type
                            }
                            onChange={(e) =>
                              updateItem(
                                idx,
                                {
                                  discount_type:
                                    e.target.value
                                }
                              )
                            }
                          >

                            <option value="fixed">
                              Fixed
                            </option>



                            <option value="percentage">
                              %
                            </option>

                          </select>



                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="line-input line-input-sm"
                            value={
                              item.discount_amount
                            }
                            onChange={(e) =>
                              updateItem(
                                idx,
                                {
                                  discount_amount:
                                    e.target.value
                                }
                              )
                            }
                          />

                        </td>

                      )}



                      {/* TAX */}

                      <td>

                        <select
                          className="line-input line-input-sm"
                          value={
                            item.tax_id ||
                            ''
                          }
                          onChange={(e) =>
                            updateItem(
                              idx,
                              {
                                tax_id:
                                  e.target.value ||
                                  null
                              }
                            )
                          }
                        >

                          <option value="">
                            No tax
                          </option>



                          {taxRates.map(
                            (t) => (

                              <option
                                key={t.id}
                                value={t.id}
                              >
                                {t.name}
                              </option>

                            )
                          )}

                        </select>

                      </td>



                      {/* LINE TOTAL */}

                      <td
                        className="line-total-cell"
                      >

                        {lineTotal.toFixed(
                          2
                        )}

                      </td>



                      {/* REMOVE */}

                      <td>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() =>
                            removeItem(
                              idx
                            )
                          }
                        >
                          ✕
                        </button>

                      </td>

                    </tr>

                  );

                }
              )}

            </tbody>

          </table>

        </div>

      )}

    </div>

  );
}
