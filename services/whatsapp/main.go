package main
import("encoding/json";"fmt";"net/http";"os";"sync";"time")
type State struct{Status string `json:"status"`; QRCode string `json:"qrCode,omitempty"`; LastError string `json:"lastError,omitempty"`}
type Send struct{To string `json:"to"`; Message string `json:"message"`; MediaURL string `json:"mediaUrl"`; Caption string `json:"caption"`}
var mu sync.Mutex; var state=State{Status:"waiting_qr",QRCode:"PORTARIAFLOW-DEMO-QR"}; var sent []Send
func write(w http.ResponseWriter,v any){w.Header().Set("Content-Type","application/json");json.NewEncoder(w).Encode(v)}
func main(){
 http.HandleFunc("/health",func(w http.ResponseWriter,r *http.Request){write(w,map[string]string{"status":"ok"})})
 http.HandleFunc("/status",func(w http.ResponseWriter,r *http.Request){mu.Lock();defer mu.Unlock();write(w,state)})
 http.HandleFunc("/connect",func(w http.ResponseWriter,r *http.Request){mu.Lock();state=State{Status:"waiting_qr",QRCode:fmt.Sprintf("PORTARIAFLOW-QR-%d",time.Now().Unix())};mu.Unlock();write(w,state)})
 http.HandleFunc("/disconnect",func(w http.ResponseWriter,r *http.Request){mu.Lock();state=State{Status:"disconnected"};mu.Unlock();write(w,state)})
 http.HandleFunc("/send-text",func(w http.ResponseWriter,r *http.Request){var s Send;json.NewDecoder(r.Body).Decode(&s);mu.Lock();sent=append(sent,s);st:=state.Status;mu.Unlock();if st!="connected"{write(w,map[string]any{"status":"queued","reason":"whatsapp disconnected; retry queue prepared"});return};write(w,map[string]string{"status":"sent"})})
 http.HandleFunc("/send-media",func(w http.ResponseWriter,r *http.Request){var s Send;json.NewDecoder(r.Body).Decode(&s);mu.Lock();sent=append(sent,s);mu.Unlock();write(w,map[string]string{"status":"queued"})})
 port:=os.Getenv("PORT"); if port==""{port="8081"}; http.ListenAndServe(":"+port,nil)
}
