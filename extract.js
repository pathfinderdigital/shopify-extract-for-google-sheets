// obtain a Shopify API token first through Settings > Apps & Sales Channels > Develop Apps.

function getShopifyProductCosts() {
  var storeName = "thenameofmyshop";  // Replace with your Shopify store name
  var accessToken = "xxxxx";  // Replace with your Shopify API Access Token 

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.clear();  // Clears existing data
  sheet.appendRow(["Product Title", "Variant Name", "Product ID", "Inventory Item ID", "Price", "Cost per Item", "Profit"]); // Headers

  var productUrl = `https://${storeName}.myshopify.com/admin/api/2024-01/products.json?limit=250`;
  
  var options = {
    method: "GET",
    headers: {
      "X-Shopify-Access-Token": accessToken,
      "Content-Type": "application/json"
    },
    muteHttpExceptions: true
  };
  
  var productResponse = UrlFetchApp.fetch(productUrl, options);
  var productData;

  try {
    productData = JSON.parse(productResponse.getContentText());
  } catch (e) {
    Logger.log("Error parsing JSON: " + e.toString());
    return;
  }

  if (!productData || !productData.products) {
    Logger.log("Error: Shopify API response missing 'products' data.");
    Logger.log(productResponse.getContentText()); // Log API response for debugging
    return;
  }

  var inventoryItemIds = [];
  var productMap = {};  // Store product details

  // Extract Product Data
  productData.products.forEach(product => {
    var productTitle = product.title || "Unknown Product";
    
    if (!product.variants) return; // Skip if variants are missing

    product.variants.forEach(variant => {
      var productId = variant.id;
      var inventoryItemId = variant.inventory_item_id;
      var variantName = variant.title || "Default Variant"; 
      var price = parseFloat(variant.price) || 0;  

      if (!inventoryItemId) return; // Skip if missing inventory ID

      // Store product details
      productMap[inventoryItemId] = {
        productId: productId,
        productTitle: productTitle,
        variantName: variantName,
        price: price
      };

      inventoryItemIds.push(inventoryItemId);
    });
  });

  if (inventoryItemIds.length === 0) {
    Logger.log("No inventory items found.");
    return;
  }

  // Fetch Cost per Item in Batches of 50
  var batchSize = 50;
  for (var i = 0; i < inventoryItemIds.length; i += batchSize) {
    var batchIds = inventoryItemIds.slice(i, i + batchSize);
    var inventoryUrl = `https://${storeName}.myshopify.com/admin/api/2024-01/inventory_items.json?ids=${batchIds.join(",")}`;

    var inventoryResponse = UrlFetchApp.fetch(inventoryUrl, options);
    var inventoryData;

    try {
      inventoryData = JSON.parse(inventoryResponse.getContentText());
    } catch (e) {
      Logger.log("Error parsing inventory JSON: " + e.toString());
      continue; // Skip this batch and proceed
    }

    if (!inventoryData || !inventoryData.inventory_items) {
      Logger.log("Error: Missing inventory items data.");
      Logger.log(inventoryResponse.getContentText()); 
      continue;
    }

    // Add results to Google Sheets
    inventoryData.inventory_items.forEach(item => {
      var productInfo = productMap[item.id];
      if (!productInfo) return; // Skip if product info is missing

      var costPerItem = parseFloat(item.cost) || 0;
      var price = productInfo.price;
      var profit = price - costPerItem; 

      sheet.appendRow([
        productInfo.productTitle, 
        productInfo.variantName, 
        productInfo.productId, 
        item.id, 
        price.toFixed(2), 
        costPerItem.toFixed(2), 
        profit.toFixed(2)
      ]);
    });

    // Delay to avoid Shopify rate limits
    Utilities.sleep(1000);
  }

  Logger.log("Data fetched successfully.");
}
