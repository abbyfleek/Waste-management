import { createClient } from '@supabase/supabase-js'

// Supabase URL and API key
const supabaseUrl = "https://fbpcfpplfetfcjzvgxnc.supabase.co"
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicGNmcHBsZmV0ZmNqenZneG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM2OTczNjEsImV4cCI6MjA1OTI3MzM2MX0.45OHr6JopL31I4PC-d0fV0eHxMPuU1Agfesj56BAjfc"
const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase

// Show signup section
function showSignup() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("signupSection").style.display = "block";
    }

// Show login section
function showLogin() {
    document.getElementById("signupSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
}

 // User Signup & Role Assignment
async function register() {
    const email = document.getElementById("signupEmail").value;
    const password = document.getElementById("signupPassword").value;
    const role = "user"; // Change to user or "collector when i need to

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        alert("Signup error: " + error.message);
                                                return;
    }

    const userId = data.user?.id || data.session?.user.id;

    //It Checks if user already exists
    const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("email", email)
        .single();

    if (checkError && checkError.code !== "PGRST100") {
        console.error(checkError);
        return;
    }

    if (existingUser) {
        alert("User already exists.");
        return;
    }

    // Insert new user with role
    const { error: roleError } = await supabase.from("users").insert([
        { id: userId, email, role }
    ]);

    if (roleError) {
        alert("Error assigning role: " + roleError.message);
    } else {
        alert("Registration successful!");
        showLogin();
    }
}

// User Login
async function login() {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert(error.message);
    } else {
        checkUserRole(data.user);
    }
}
          
// Check User Role
async function checkUserRole(user) {
    const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    if (error) {
        alert('Error fetching user role: ' + error.message);
        return;
    }

    const role = data.role;
    document.getElementById('userEmail').innerText = user.email;

    // Hide all dashboards first
    document.getElementById("userDashboard").style.display = "none";
    document.getElementById("adminDashboard").style.display = "none";

    if (role === "admin") {
        document.getElementById("adminDashboard").style.display = "block";
        loadAdminDashboard();
    } else {
        document.getElementById("userDashboard").style.display = "block";
    }

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("signupSection").style.display = "none";
}        

// User Logout  
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('Error signing out: ' + error.message);
    } else {
        alert("Logged out successfully!");
        location.reload();
    }
}

// Keep user logged in after refresh
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        // User is logged in, proceed to check the user role
        checkUserRole(session.user);
    } else {
        // User is not logged in, show login screen
        showLogin();
    }
});

// Refresh page
function refreshPage() {
    location.reload();
}

//Load Admin Dashboard Data
async function loadAdminDashboard() {
    const { data, error } = await supabase
        .from("bins")
        .select("bin_id, location, waste_level"); // Modify this based on the actual columns you need

    if (error) {
        console.error("Error fetching bins:", error.message);
        return;
    }

    let binData = "";
    if (data.length === 0) {
        // If no bins are found, prompt to add a new bin
        if (confirm("No bins found. Would you like to add a new one?")) {
            promptAddBin();
        }
    } else {
        // Loop through the bins data and create the table rows
        data.forEach(bin => {
            binData += 
                `<tr>
                    <td>${bin.bin_id}</td>
                    <td>${bin.location}</td>
                    <td>${bin.waste_level}%</td>
                </tr>`;
        });
    }

    // Insert the bin data into the table
    document.getElementById("binData").innerHTML = binData;
}
      
// QR Code Scanning and Location Verification
function scanQR() {
    // Request access to the camera
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
        .then(stream => {
            const video = document.createElement("video");
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            // Set up the video stream to display the camera feed
            video.srcObject = stream;
            video.play();
            video.style.display = "none"
            document.body.appendChild(video); //This appends the video to the page

            // Keeps scanning the video feed every 500ms
            const interval = setInterval(() => {
                if (video.readyState === video.HAVE_ENOUGH_DATA) {
                    // Set canvas dimensions to match video dimensions
                    canvas.height = video.videoHeight;
                    canvas.width = video.videoWidth;

                    // Draw the video frame to the canvas
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // Get image data from the canvas
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                    // Attempt to decode a QR code from the image data
                    const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

                    if (qrCode) {
                        // If a QR code is found, process it (verify location)
                        verifyQRLocation(qrCode.data);

                        // Stop the video stream and remove video element from the page
                        video.srcObject.getTracks().forEach(track => track.stop());
                        document.body.removeChild(video);
                        clearInterval(interval); // Stop the interval once QR code is found
                    }
                }
            }, 500); // Check every 500ms
        })
        .catch(error => {
            console.error("Error accessing camera: ", error.message);
            alert("Unable to access the camera. Please check permissions.");
        });
}

// Verify the QR code location and compare it with the user's location
function verifyQRLocation(qrCode) {
    navigator.geolocation.getCurrentPosition(position => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Fetch QR code data from Supabase using the qrCode parameter
        supabase
            .from("qr_codes")  // Assuming you have a table named 'qr_codes' in Supabase
            .select("latitude, longitude, bin_id")
            .eq("qr_code", qrCode)  // Filter by the scanned QR code
            .single()  // Ensure we get only one record
            .then(({ data, error }) => {
                if (error) {
                    console.error("Error fetching QR code data:", error.message);
                    alert("❌ QR code not registered.");
                    return;
                }

                const qrLat = data.latitude;
                const qrLng = data.longitude;

                const distance = getDistanceFromLatLonInMeters(qrLat, qrLng, userLat, userLng);

                if (distance <= 10) {
                    alert("✅ Location verified successfully!");
                    updateAndCheckWasteLevel(data.bin_id, CURRENT_LEVEL_FROM_SENSOR); // Assuming this is a function that checks the fill level of the bin
                } else {
                    alert("🚨 Wrong Location!");
                }
            });
    }, () => {
        alert("❌ Location access denied.");
    });
}

// Haversine formula to calculate distance in meters
function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;  // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;  // Returns distance in meters
}
 
//Bin information
async function fetchBinData(binId) {
    const { data, error } = await supabase
        .from("bins")
        .select("bin_id, location, last_pickup, qr_url")
        .eq("bin_id", binId)
        .single();

    if (error) {
        console.error("Error fetching bin data:", error.message);
    } else {
        console.log("Bin Data:", data);
        displayBinInfo(data);  // Display the bin info, including QR code URL
    }
}

function displayBinInfo(binData) {
    // Display the bin information (e.g., location, last pickup date, QR code image)
    document.getElementById("binLocation").innerText = binData.location;
    document.getElementById("lastPickup").innerText = binData.last_pickup;
    document.getElementById("qrCodeImage").src = binData.qr_url;  // Display the QR code image
}

// Update Waste Level & Check (Supabase version)
async function updateAndCheckWasteLevel(binId, newWasteLevel) {
    // Update the waste level and last updated timestamp
    const { data, error } = await supabase
        .from("bins") // Reference to the bins table in Supabase
        .update({ 
            waste_level: newWasteLevel, 
            last_updated: new Date().toISOString()  // Use ISO string for timestamp
        })
        .eq("bin_id", binId);  // Ensure you're updating the correct bin by matching bin_id

    // Check if there's an error in the update operation
    if (error) {
        console.log("Error updating waste level:", error.message);
        return;
    } else {
        console.log("Bin updated:", data);
    }

    // Now retrieve the updated bin data to check its fill level
    const { data: updatedBinData, error: fetchError } = await supabase
        .from("bins")
        .select("waste_level") // Select the waste level
        .eq("bin_id", binId)
        .single();  // Expecting a single row since we're querying by bin_id

    // This Checks if there's an error in fetching updated bin data
    if (fetchError) {
        console.log("Error fetching updated bin data:", fetchError.message);
        return;
    }

    const level = updatedBinData.waste_level;

    // Update the UI with the new fill level
    const fillLevelElement = document.getElementById("fillLevel");
    if (fillLevelElement) {
        fillLevelElement.innerText = `Bin Fill Level: ${level}%`;
    }

    // Alert if the bin fill level is over 80%
    if (level > 80) {
        alert("⚠️ Bin is over 80% full! Please schedule collection.");
    }
}

//M-Pesa Payment (Daraja API)
async function makePayment() {
    const phoneNumber = prompt("Enter your M-Pesa number:");
    if (!phoneNumber) {
        alert("Please enter a phone number");
        return;
    }

    try {
        const response = await axios.post("YOUR_DARAJA_API_ENDPOINT", {
            phoneNumber,
            amount: 100,
        });

        alert("Payment successful!");
    } catch (error) {
        alert("Payment failed: " + error.message);
    }
}
