{% assign prog_mode    = shop.metafields.bwb_progressive.mode | default: 'off' %}
{% assign step1        = shop.metafields.bwb_progressive.step_1 %}
{% assign step2        = shop.metafields.bwb_progressive.step_2 %}
{% assign step3        = shop.metafields.bwb_progressive.step_3 %}
{% assign trigger_code = shop.metafields.bwb_progressive.trigger_code %}

{% if prog_mode != 'off' %}
  <script>
    // Make functions globally available
    window.CartUtils = window.CartUtils || {};

    window.BwBProgressive = window.BwBProgressive || {};
    window.BwBProgressive.triggerCode = '{{ trigger_code | escape }}';

    /**
     * Fetch the current cart (returns JSON)
     * @returns {Promise<Object>} Cart data
     */
    async function getCart() {
      try {
        const res = await fetch('/cart.js', {
          headers: { Accept: 'application/json' },
          cache: 'no-cache'
        });
        if (!res.ok) throw new Error(`Failed to fetch cart: ${res.status}`);
        return res.json();
      } catch (error) {
        console.error('Error fetching cart:', error);
        throw error;
      }
    }

    /**
     * Set multiple cart.attributes at once.
     * @param {Object} attributes - Object with key-value pairs
     * @returns {Promise<Object>} Updated cart data
     */
    async function setCartAttributes(attributes) {
      if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
        throw new Error('attributes must be a plain object');
      }

      const cleanAttributes = Object.entries(attributes).reduce((acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {});

      if (Object.keys(cleanAttributes).length === 0) {
        console.warn('No valid attributes to set');
        return getCart();
      }

      try {
        const res = await fetch('/cart/update.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ attributes: cleanAttributes }),
        });

        if (!res.ok) {
          let message = `Failed to update cart.attributes (${res.status})`;
          try {
            const err = await res.json();
            if (err && err.description) message += `: ${err.description}`;
          } catch (_) {}
          throw new Error(message);
        }

        const result = await res.json();
        console.log('Cart attributes updated:', cleanAttributes);
        return result;
      } catch (error) {
        console.error('Error updating cart attributes:', error);
        throw error;
      }
    }

    /**
     * Set a single cart attribute.
     * @param {string} key
     * @param {string|number} value
     */
    async function setCartAttribute(key, value) {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        throw new Error('key must be a non-empty string');
      }
      await setCartAttributes({ [key]: value });
    }

    /**
     * Remove a single cart attribute.
     * @param {string} key
     */
    async function deleteCartAttribute(key) {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        throw new Error('key must be a non-empty string');
      }
      return setCartAttributes({ [key]: '' });
    }

    /**
     * Read a single attribute value from the cart
     * @param {string} key
     * @returns {Promise<string|undefined>}
     */
    async function getCartAttribute(key) {
      if (!key || typeof key !== 'string' || key.trim() === '') {
        throw new Error('key must be a non-empty string');
      }

      try {
        const cart = await getCart();
        return cart?.attributes ? cart.attributes[key] : undefined;
      } catch (error) {
        console.error('Error getting cart attribute:', error);
        throw error;
      }
    }

    /**
     * Get all cart attributes
     * @returns {Promise<Object>}
     */
    async function getAllCartAttributes() {
      try {
        const cart = await getCart();
        return cart?.attributes || {};
      } catch (error) {
        console.error('Error getting all cart attributes:', error);
        throw error;
      }
    }

    /**
     * Get active discount codes from cart
     * @returns {Promise<string>} Comma-separated list of active discount code titles
     */
    async function getActiveDiscountCodes() {
      try {
        const cart = await getCart();
        const discounts = cart?.cart_level_discount_applications || [];

        if (discounts.length === 0) {
          return '';
        }

        const titles = discounts
          .map(discount => discount.title)
          .filter(title => title && title.trim() !== '');

        return titles.join(', ');
      } catch (error) {
        console.error('Error getting active discount codes:', error);
        throw error;
      }
    }

    /**
     * Update active_codes attribute with current active discount codes from cart
     * @returns {Promise<Object>} Updated cart data
     */
    async function updateActiveCodesFromCart() {
      try {
        if (window.__updatingActiveCodes) {
          return getCart();
        }
        window.__updatingActiveCodes = true;

        const cart = await getCart();
        const currentValue = cart?.attributes?.active_codes || '';
        const activeCodes = await getActiveDiscountCodes();

        if (activeCodes === currentValue) {
          return cart;
        }

        if (activeCodes && activeCodes.trim() !== '') {
          await setCartAttribute('active_codes', activeCodes);
          console.log('Active codes updated from cart:', activeCodes);
        } else if (currentValue !== '') {
          await deleteCartAttribute('active_codes');
          console.log('No active discount codes - attribute removed');
        }

        return getCart();
      } catch (error) {
        console.error('Error updating active codes from cart:', error);
        throw error;
      } finally {
        window.__updatingActiveCodes = false;
      }
    }

    // Expose functions
    window.CartUtils.getCart = getCart;
    window.CartUtils.setCartAttributes = setCartAttributes;
    window.CartUtils.setCartAttribute = setCartAttribute;
    window.CartUtils.deleteCartAttribute = deleteCartAttribute;
    window.CartUtils.getCartAttribute = getCartAttribute;
    window.CartUtils.getAllCartAttributes = getAllCartAttributes;
    window.CartUtils.getActiveDiscountCodes = getActiveDiscountCodes;
    window.CartUtils.updateActiveCodesFromCart = updateActiveCodesFromCart;

    // Also on window for backward compatibility
    window.getCart = getCart;
    window.setCartAttributes = setCartAttributes;
    window.setCartAttribute = setCartAttribute;
    window.deleteCartAttribute = deleteCartAttribute;
    window.getCartAttribute = getCartAttribute;
    window.getActiveDiscountCodes = getActiveDiscountCodes;
    window.updateActiveCodesFromCart = updateActiveCodesFromCart;

    /* ------------------ INITIALIZATION ------------------ */

    (async function initializeCartAttributes() {
      try {
        // 0) Write the mode as an attribute so the Function can see it
        await setCartAttribute('progressive_mode', '{{ prog_mode }}');

        // 1) Save progression steps (tiers)
        const progressionSteps = {};
        {% if step1 %}
          progressionSteps.step_1 = '{{ step1 }}';
        {% endif %}
        {% if step2 %}
          progressionSteps.step_2 = '{{ step2 }}';
        {% endif %}
        {% if step3 %}
          progressionSteps.step_3 = '{{ step3 }}';
        {% endif %}

        if (Object.keys(progressionSteps).length > 0) {
          await setCartAttributes(progressionSteps);
        }

        // 2) Save the list of applicable discount codes (trigger code)
        {% if trigger_code %}
          await setCartAttribute('progression_codes', '{{ trigger_code }}');
        {% endif %}

        // 3) Handle active discount codes (initial load)
        {% if cart.cart_level_discount_applications.size > 0 %}
          {% assign active_discounts = cart.cart_level_discount_applications | map: 'title' | join: ', ' %}
          await setCartAttribute('active_codes', '{{ active_discounts }}');
        {% else %}
          await deleteCartAttribute('active_codes');
        {% endif %}
      } catch (error) {
        console.error('Error initializing cart attributes:', error);
        // Don't throw - let the page continue loading
      }
    })();

    console.log('cart', {{ cart | json }});

    // Rebuy Smart Cart: fires on quantity/add/remove changes
    document.addEventListener('rebuy:cart.change', function(event) {
      try {
        // Update active codes from cart when cart changes
        updateActiveCodesFromCart().catch(err => {
          console.error('Error updating active codes:', err);
        });

        let form = document.querySelector('.rebuy-cart__discount-form');
        form?.addEventListener('submit', function(evt) {
          evt.preventDefault();
          const target = evt.target.querySelector('#rebuy-cart__discount-input');
          if (target && target.value) {
            window.setCartAttribute('active_codes', target.value);
          } else {
            updateActiveCodesFromCart().catch(err => {
              console.error('Error updating active codes:', err);
            });
          }
        });

        let removeBtn = document.querySelector('.rebuy-cart__discount-tag-remove');
        removeBtn?.addEventListener('click', function(evt) {
          evt.preventDefault();
          updateActiveCodesFromCart().catch(err => {
            console.error('Error updating active codes:', err);
          });
        });
      } catch (e) {
        console.error('Error in rebuy:cart.change handler:', e);
      }
    });
  </script>
{% endif %}