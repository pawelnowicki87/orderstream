# Dlaczego tak, a nie inaczej

Notatki projektowe. Każda sekcja tłumaczy jedną decyzję: co wybrano, jaka była alternatywa i czym za to płacimy.

## Dlaczego pięć serwisów, a nie jeden monolit

Monolit byłby szybszy do napisania i prostszy w utrzymaniu. Sens tego projektu jest jednak dydaktyczny i portfolio'wy: pokazać, że rozumiem komunikację między procesami, granice serwisów i architekturę zdarzeniową. Podział jest celowo taki, żeby każdy serwis miał **jedną** odpowiedzialność:

- `auth-service` — tożsamość i wydawanie tokenów
- `restaurant-service` — katalog i ceny (jedyne źródło prawdy o cenie)
- `order-service` — cykl życia zamówienia
- `notification-service` — dostarczanie zdarzeń do przeglądarki
- `api-gateway` — jedno wejście, routing, weryfikacja tokenu

Koszt: pięć procesów do uruchomienia, pięć konfiguracji, trudniejsze debugowanie. W prawdziwym produkcie o tej skali monolit byłby rozsądniejszy.

## Dlaczego gRPC do jednej rzeczy, a Kafka do drugiej

To jest główna myśl całego projektu.

**gRPC (synchronicznie)** — `order-service` pyta `restaurant-service`: „czy te pozycje są dostępne i ile to kosztuje?". Klient czeka na odpowiedź, bez niej nie da się przyjąć zamówienia. Wywołanie musi się zakończyć, zanim odpowiemy użytkownikowi. Do tego gRPC jest szybkie i ma kontrakt opisany w pliku `.proto`, więc obie strony kompilują dokładnie te same typy.

**Kafka (asynchronicznie)** — zmiana statusu zamówienia to fakt, który już się wydarzył. Nikt na nic nie czeka. `order-service` publikuje zdarzenie i idzie dalej. Dziś konsumuje je `notification-service`; jutro można dołożyć serwis analityczny albo wysyłkę maili **bez dotykania producenta**. To jest realna zaleta architektury zdarzeniowej, nie tylko modne słowo.

*Co się stanie, jeśli `notification-service` padnie?* Zamówienia dalej działają. Zdarzenia czekają w Kafce i zostaną skonsumowane po restarcie (bo mamy `auto-offset-reset: earliest` i offsety grupy konsumenckiej). Gdyby to było wywołanie synchroniczne, padłby cały proces składania zamówienia.

## Dlaczego klucz wiadomości to ID zamówienia

Kafka gwarantuje kolejność **w obrębie partycji**. Ustawiając ID zamówienia jako klucz, wszystkie zdarzenia jednego zamówienia trafiają na tę samą partycję, więc `PLACED` nigdy nie dotrze po `CONFIRMED`. Bez klucza, przy więcej niż jednej partycji, statusy mogłyby się pomieszać.

## Dlaczego cena liczy się po stronie serwera

Żądanie złożenia zamówienia (`PlaceOrderRequest`) **nie ma pola z ceną**. Klient wysyła tylko ID pozycji i ilości; kwotę wylicza `restaurant-service` i zwraca przez gRPC. Gdyby cena przychodziła z przeglądarki, wystarczyłoby podmienić ją w narzędziach deweloperskich i kupić pizzę za grosz. To ta sama zasada co przy każdej walidacji: **nigdy nie ufaj danym od klienta**.

## Dlaczego token sprawdza gateway, a nie każdy serwis

`api-gateway` weryfikuje podpis JWT i wstrzykuje nagłówek `X-User-Id` do żądania idącego dalej. Serwisy wewnętrzne nie znają się na tokenach — ufają nagłówkowi.

Zaleta: logika bezpieczeństwa jest w jednym miejscu, serwisy są prostsze.
Wada: **to działa tylko dlatego, że serwisy wewnętrzne nie są wystawione na świat**. Gdyby ktoś dostał się do sieci wewnętrznej, mógłby wysłać dowolne `X-User-Id`. W produkcji albo sieć musi być naprawdę odcięta, albo każdy serwis musi sam weryfikować token (wtedy używa się `spring-boot-starter-oauth2-resource-server`).

To świadomy kompromis, a nie przeoczenie.

## Dlaczego gateway nie ma bazy danych

Spring Cloud Gateway działa na WebFluksie, czyli reaktywnie i nieblokująco. JPA jest blokujące. Wrzucenie logowania z bazą do gatewaya oznacza blokowanie wątków pętli zdarzeń, co w najlepszym razie psuje wydajność, a w gorszym wywala aplikację przy starcie. Dlatego logowanie mieszka w osobnym `auth-service` na zwykłym stosie serwletowym.

## Dlaczego plik .proto jest zduplikowany

Ten sam `restaurant.proto` leży w `restaurant-service` i w `order-service`. Poprawniej byłoby mieć wspólny moduł Mavena z kontraktem. Wymaga to jednak parent POM-a, kolejności budowania i publikowania artefaktu — dużo maszynerii jak na jeden mały plik. Przy większej liczbie kontraktów warto to zrobić inaczej: osobne repozytorium ze schematami albo rejestr schematów.

## Dlaczego `CustomerOrder`, a nie `Order`

`order` i `user` to słowa zarezerwowane w SQL-u. Encja nazwana `Order` generuje zapytanie `select ... from order`, które kończy się błędem składni. Stąd `CustomerOrder` i `AppUser`.

## Dlaczego kwoty są w groszach jako `long`

Nigdy nie trzyma się pieniędzy w `double` ani `float`. `0.1 + 0.2` w arytmetyce zmiennoprzecinkowej nie daje `0.3`. Standardowe rozwiązania to liczby całkowite w najmniejszej jednostce (grosze) albo `BigDecimal`. Tu wybrano `long` w groszach — prostsze i wystarczające.

## Dlaczego WebSocket bez SockJS

SockJS to biblioteka dająca fallback dla przeglądarek bez WebSocketów. W 2026 każda przeglądarka je obsługuje, a `sockjs-client` wymaga polyfilla `global` pod bundlerem Angulara i regularnie psuje build. Czysty WebSocket z `@stomp/stompjs` załatwia sprawę bez tego bagażu.

## Dlaczego `enableSimpleBroker`, i co to ogranicza

`enableSimpleBroker` to broker STOMP trzymany w pamięci aplikacji. Działa świetnie dla jednej instancji. Gdyby uruchomić dwie instancje `notification-service` za load balancerem, przeglądarka podłączona do instancji A nie dostałaby wiadomości wysłanej przez instancję B. Rozwiązaniem jest zewnętrzny broker (`enableStompBrokerRelay` + RabbitMQ lub ActiveMQ).

## Dlaczego symulator postępu zamówienia

Nie ma prawdziwej kuchni ani kuriera, więc zaplanowane zadanie (`@Scheduled`) co 15 sekund przesuwa każde aktywne zamówienie o jeden status dalej. Dzięki temu ekran śledzenia **rusza się sam**, kiedy ktoś ogląda demo. To jedyny element czysto demonstracyjny w całym systemie.

## Dlaczego `ddl-auto: update`

Hibernate sam tworzy tabele na podstawie encji. Wygodne przy nauce, niedopuszczalne w produkcji — nie ma wersjonowania, nie ma kontroli nad tym, co się stanie przy zmianie schematu, nie da się zrobić rollbacku. Produkcyjnie używa się Flyway albo Liquibase, gdzie każda zmiana schematu to ponumerowany plik SQL w repozytorium.

## Dlaczego testy wyglądają tak, a nie inaczej

Testy jednostkowe (`OrderStatusTest`, `OrderValidatorTest`) sprawdzają czystą logikę — bez Springa, bez bazy, milisekundy na test. Dlatego logika walidacji siedzi w zwykłej klasie `OrderValidator`, a nie w klasie gRPC: **kod łatwy do przetestowania to kod, który nie jest wpleciony we framework**.

Test integracyjny (`OrderFlowIntegrationTest`) idzie w drugą stronę: prawdziwy PostgreSQL i prawdziwa Kafka w kontenerach (Testcontainers), prawdziwe żądanie HTTP, sprawdzenie że zdarzenie faktycznie wylądowało na topicu. Wolniejszy, ale testuje to, czego testy jednostkowe nie dotkną — czy te wszystkie kawałki naprawdę się ze sobą spinają.

Wywołanie gRPC jest w tym teście zamockowane, bo `restaurant-service` to osobny proces, a ten test sprawdza zachowanie `order-service`.

## Dlaczego panel „What just happened in the backend"

Demo aplikacji z mikroserwisami ma jeden wrodzony problem: cała wartość siedzi w miejscach, których nie widać. Osoba oglądająca demo klika „zamów", widzi zmieniający się napis i nie ma pojęcia, że po drodze było wywołanie gRPC, zdarzenie w Kafce i push przez WebSocket. Panel rysuje tę ścieżkę w reakcji na prawdziwe zdarzenia, nie z timera. Pełna ścieżka złożenia zamówienia (REST → gRPC → Kafka) odpala się raz, po udanej odpowiedzi `POST /api/orders` — w tej odpowiedzi jest już cena policzona przez gRPC. Każda kolejna animacja to reakcja na konkretną wiadomość z `/topic/orders/{id}`.

Czas „ms end to end" w logu to różnica między `occurredAt` (ustawianym w `order-service` przy publikacji) a chwilą odebrania wiadomości w przeglądarce. Obejmuje więc Kafkę, konsumenta i WebSocket. Zegary serwera i przeglądarki mogą się różnić, dlatego wartości ujemne albo absurdalnie duże są ukrywane zamiast pokazywane.

## Dlaczego jedno połączenie WebSocket na całą aplikację

`StompService` trzyma jedno połączenie i rozdaje subskrypcje. Strona śledzenia słucha `/topic/orders/{id}`, a powłoka aplikacji równolegle `/topic/users/{id}` — z tego drugiego biorą się powiadomienia na każdej stronie. Osobne połączenie dla każdego widoku działałoby, ale mnożyłoby sockety i gubiło subskrypcje po restarcie backendu. Serwis po ponownym połączeniu sam podpina wszystkie aktywne subskrypcje.

## Dlaczego konto demo zamiast wspólnego loginu „demo/demo"

Wspólne konto oznaczałoby, że dwie osoby oglądające demo w tym samym czasie widzą nawzajem swoje zamówienia i powiadomienia. Przycisk „Try the demo" rejestruje więc za każdym razem nowego, losowego użytkownika. Kosztem jest rosnąca tabela `app_users` — przy ruchu z portfolio to bez znaczenia.

---

# Nieoczywiste miejsca w konfiguracji

Rzeczy, które nie zadziałały od ręki, i dlaczego rozwiązanie wygląda tak, a nie inaczej.

## Spring Boot 3.5 zamiast 4.x

Spring Initializr generuje już wyłącznie projekty na Boocie 4. Projekt zostaje na 3.5.16 — najnowszym patchu linii 3 — bo `net.devh:grpc-spring-boot-starter` (ostatnie wydanie 3.1.0) nie ma wersji pod Boota 4, a oficjalny `org.springframework.grpc` jest jeszcze przed wersją 1.0. Boot 4 zmienia też nazwy starterów (`spring-boot-starter-webmvc` zamiast `-web`), artefakty Spring Cloud Gateway i DSL Security 7. Wersja rodzica jest więc wpisana ręcznie w każdym `pom.xml`, a `api-gateway` importuje BOM `spring-cloud-dependencies:2025.0.3` — release train pasujący do Boota 3.5.

## `javax.annotation-api` w serwisach z gRPC

Stuby generowane przez `protoc-gen-grpc-java` są adnotowane `@javax.annotation.Generated`, a ta klasa zniknęła z JDK w Javie 9. Bez tej zależności kompilacja wygenerowanego kodu przerywa się na `cannot find symbol: class Generated`. Dotyczy `restaurant-service` i `order-service`.

## Kafka: `CONTROLLER://:9093` zamiast `CONTROLLER://0.0.0.0:9093`

Kafka 3.9 waliduje adres rozgłaszany przez listener CONTROLLER i odrzuca nieroutowalny `0.0.0.0`. W trybie łączonym (`broker,controller`) listenera CONTROLLER nie wolno umieścić w `advertised.listeners`, więc Kafka dziedziczy jego adres z `listeners`. Pusty host oznacza „nasłuchuj na wszystkich interfejsach, rozgłaszaj nazwę hosta kontenera" i to startuje poprawnie. Dotyczy obu plików compose.

W teście integracyjnym ten sam problem wraca w innej postaci: Testcontainers 1.21.4 startuje `apache/kafka:3.9.0` właśnie z `0.0.0.0` i kontener nie wstaje. Dlatego test używa obrazu `apache/kafka:3.8.1`.

## `@MockitoBean` zamiast `@MockBean`

`@MockBean` jest wycofany od Boota 3.4, więc test integracyjny używa jego następcy, `@MockitoBean`.

## Postgres na porcie 5433 w trybie deweloperskim

Na maszynie deweloperskiej port 5432 często zajmuje już inny Postgres. `docker-compose.yml` mapuje więc `5433:5432`, a `application.yml` każdego serwisu wskazuje `localhost:5433`. Wewnątrz sieci dockerowej nic się nie zmienia — `docker-compose.full.yml` dalej używa `postgres:5432`.

## Nginx frontendu proxuje `/api` i `/ws`

Produkcyjny build frontendu używa ścieżek względnych wszędzie poza dev serverem na porcie 4200, a `docker-compose.full.yml` serwuje go na 4300. Bez bloków proxy żądanie `/api/restaurants` wpadało w regułę `try_files` i dostawało `index.html` (HTTP 200, `text/html`), więc aplikacja w kontenerze nie miała jak dosięgnąć backendu. Bloki `location /api/` i `location /ws` kierują ruch do `api-gateway:8080` i `notification-service:8084` po sieci dockerowej. `infra/nginx.conf` (proxy na serwerze docelowym) jest osobnym plikiem.

## Node 24 w obrazie frontendu i w CI

Angular CLI 22 wymaga Node ≥ 22.22.3 i przerywa build na Node 20.

## Bez testu `contextLoads` w auth-service

Stub `contextLoads` z Initializr podnosi pełny kontekst Springa, więc wymaga działającego PostgreSQL-a. W CI Docker jest potrzebny tylko w zadaniu `order-service` (Testcontainers), a ten test nie weryfikował niczego poza dostępnością bazy — dlatego go nie ma.

## `app.spec.ts` sprawdza powłokę aplikacji

Test wygenerowany przez Angular CLI sprawdzał nagłówek domyślnej strony powitalnej („Hello, frontend") i nie dostarczał `HttpClient` wymaganego przez `AuthService`. Teraz sprawdza, że powłoka renderuje link logowania dla niezalogowanego użytkownika.
